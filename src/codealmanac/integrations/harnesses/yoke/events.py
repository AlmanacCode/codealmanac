from __future__ import annotations

import math
from dataclasses import dataclass, field

from pydantic import JsonValue
from yoke import AgentCall, Event, EventKind, Provider

from codealmanac.services.harnesses.models import (
    HarnessActorConfidence,
    HarnessActorRole,
    HarnessAgentTrace,
    HarnessEvent,
    HarnessEventKind,
    HarnessKind,
    HarnessRunActor,
    HarnessToolDisplay,
    HarnessToolDisplayKind,
    HarnessToolStatus,
    HarnessUsage,
)


@dataclass
class YokeEventProjector:
    """Project normalized Yoke events into CodeAlmanac's durable event DTO."""

    kind: HarnessKind
    root_thread_id: str | None = None
    parents: dict[str, str | None] = field(default_factory=dict)
    labels: dict[str, str] = field(default_factory=dict)
    emitted_lifecycle: set[tuple[str, HarnessEventKind]] = field(
        default_factory=set
    )

    def project(self, event: Event) -> tuple[HarnessEvent, ...]:
        self.note_root(event)
        actor = self.actor_for(event)
        projected = self.base_event(event, actor)
        return (projected, *self.agent_events(event, actor))

    def note_root(self, event: Event) -> None:
        if self.root_thread_id is None and event.provider_session_id:
            self.root_thread_id = event.provider_session_id
        if (
            self.root_thread_id is None
            and self.kind is HarnessKind.CODEX
            and event.source_thread_id
        ):
            self.root_thread_id = event.source_thread_id

    def actor_for(self, event: Event) -> HarnessRunActor:
        helper_id = self.helper_id(event)
        if helper_id is not None:
            parent = self.parents.get(helper_id) or self.root_thread_id
            self.parents.setdefault(helper_id, parent)
            return HarnessRunActor(
                thread_id=helper_id,
                role=HarnessActorRole.HELPER,
                parent_thread_id=parent,
                label=self.helper_label(helper_id),
                confidence=(
                    HarnessActorConfidence.PROVIDER
                    if self.kind is HarnessKind.CODEX
                    else HarnessActorConfidence.DERIVED
                ),
            )
        if self.root_thread_id is not None:
            return HarnessRunActor(
                thread_id=self.root_thread_id,
                role=HarnessActorRole.ROOT,
                label="Main",
                confidence=HarnessActorConfidence.PROVIDER,
            )
        return HarnessRunActor(
            role=HarnessActorRole.UNKNOWN,
            label="Unknown actor",
            confidence=HarnessActorConfidence.UNKNOWN,
        )

    def helper_id(self, event: Event) -> str | None:
        if self.kind is HarnessKind.CLAUDE:
            return event.provider_parent_tool_use_id
        thread_id = event.source_thread_id
        if thread_id and thread_id != self.root_thread_id:
            return thread_id
        return None

    def helper_label(self, helper_id: str) -> str:
        if helper_id not in self.labels:
            self.labels[helper_id] = f"Helper {len(self.labels) + 1}"
        return self.labels[helper_id]

    def base_event(self, event: Event, actor: HarnessRunActor) -> HarnessEvent:
        tool = event.tool
        usage = event.usage
        return HarnessEvent(
            kind=event_kind(event.kind),
            message=event_message(event),
            actor=actor,
            tool_id=nonblank(event.tool_id),
            tool_name=nonblank(event.tool_name),
            tool_input=nonblank(event.tool_input),
            tool_display=(
                HarnessToolDisplay(
                    kind=HarnessToolDisplayKind(str(tool.kind)),
                    title=nonblank(tool.title),
                    path=nonblank(tool.path),
                    command=nonblank(tool.command),
                    cwd=nonblank(tool.cwd),
                    status=(
                        HarnessToolStatus(str(tool.status))
                        if tool.status is not None
                        else None
                    ),
                    exit_code=tool.exit_code,
                    duration_ms=tool.duration_ms,
                    summary=nonblank(tool.summary),
                    provider_thread_id=nonblank(event.source_thread_id),
                    provider_turn_id=nonblank(event.source_turn_id),
                )
                if tool is not None
                else None
            ),
            tool_result=json_value(event.tool_result),
            tool_is_error=event.tool_is_error,
            usage=(
                HarnessUsage(
                    input_tokens=usage.input_tokens,
                    cache_creation_input_tokens=(
                        usage.cache_creation_input_tokens
                    ),
                    cached_input_tokens=usage.cached_input_tokens,
                    output_tokens=usage.output_tokens,
                    reasoning_output_tokens=usage.reasoning_output_tokens,
                    total_tokens=usage.total_tokens,
                    total_processed_tokens=usage.total_processed_tokens,
                    max_tokens=usage.max_tokens,
                )
                if usage is not None
                else None
            ),
            provider_session_id=nonblank(event.provider_session_id),
            provider_event_id=nonblank(event.provider_event_id),
            provider_parent_tool_use_id=nonblank(
                event.provider_parent_tool_use_id
            ),
            source_thread_id=nonblank(event.source_thread_id),
            source_turn_id=nonblank(event.source_turn_id),
            source_role=actor.role,
        )

    def agent_events(
        self,
        event: Event,
        actor: HarnessRunActor,
    ) -> tuple[HarnessEvent, ...]:
        call = event.agent
        if call is None:
            return ()
        action = (call.action or "").lower()
        if action in {"spawnagent", "spawned", "started", "start"}:
            return self.spawned_events(event, call, actor)
        if action in {"wait", "waiting"}:
            if event.kind is EventKind.TOOL_RESULT:
                return self.completed_events(event, call, actor)
            return self.wait_event(call, actor)
        if action in {"completed", "stopped", "failed", "closeagent"} and (
            event.kind is EventKind.TOOL_RESULT
        ):
            return self.completed_events(event, call, actor)
        return ()

    def spawned_events(
        self,
        event: Event,
        call: AgentCall,
        actor: HarnessRunActor,
    ) -> tuple[HarnessEvent, ...]:
        children = child_ids(event, call, self.kind)
        events: list[HarnessEvent] = []
        parent = call.sender_thread_id or actor.thread_id or self.root_thread_id
        for child in children:
            self.parents[child] = parent
            lifecycle = (child, HarnessEventKind.AGENT_SPAWNED)
            if lifecycle in self.emitted_lifecycle:
                continue
            self.emitted_lifecycle.add(lifecycle)
            events.append(
                HarnessEvent(
                    kind=HarnessEventKind.AGENT_SPAWNED,
                    message=f"spawned {self.helper_label(child)}",
                    actor=actor,
                    agent_trace=HarnessAgentTrace(
                        parent_thread_id=parent,
                        child_thread_id=child,
                        prompt=nonblank(call.prompt),
                        model=nonblank(call.model),
                        reasoning_effort=nonblank(call.reasoning_effort),
                    ),
                )
            )
        return tuple(events)

    def wait_event(
        self,
        call: AgentCall,
        actor: HarnessRunActor,
    ) -> tuple[HarnessEvent, ...]:
        children = tuple(filter(None, call.receiver_thread_ids))
        return (
            HarnessEvent(
                kind=HarnessEventKind.AGENT_WAIT_STARTED,
                message="waiting for helper agents",
                actor=actor,
                agent_trace=HarnessAgentTrace(
                    parent_thread_id=call.sender_thread_id or actor.thread_id,
                    child_thread_ids=children,
                ),
            ),
        )

    def completed_events(
        self,
        event: Event,
        call: AgentCall,
        actor: HarnessRunActor,
    ) -> tuple[HarnessEvent, ...]:
        children = child_ids(event, call, self.kind)
        events: list[HarnessEvent] = []
        for child in children:
            lifecycle = (child, HarnessEventKind.AGENT_COMPLETED)
            if lifecycle in self.emitted_lifecycle:
                continue
            self.emitted_lifecycle.add(lifecycle)
            helper = self.actor_for_child(child)
            result = completion_message(event, call, child)
            events.append(
                HarnessEvent(
                    kind=HarnessEventKind.AGENT_COMPLETED,
                    message=result,
                    actor=helper,
                    agent_trace=HarnessAgentTrace(
                        parent_thread_id=helper.parent_thread_id,
                        child_thread_id=child,
                        result=result,
                    ),
                )
            )
        return tuple(events)

    def actor_for_child(self, child: str) -> HarnessRunActor:
        return HarnessRunActor(
            thread_id=child,
            role=HarnessActorRole.HELPER,
            parent_thread_id=self.parents.get(child) or self.root_thread_id,
            label=self.helper_label(child),
            confidence=(
                HarnessActorConfidence.PROVIDER
                if self.kind is HarnessKind.CODEX
                else HarnessActorConfidence.DERIVED
            ),
        )


def event_kind(value: EventKind | str) -> HarnessEventKind:
    try:
        return HarnessEventKind(str(value))
    except ValueError:
        return HarnessEventKind.UNKNOWN


def event_message(event: Event) -> str:
    return (
        nonblank(event.message)
        or (nonblank(event.tool.title) if event.tool is not None else None)
        or nonblank(event.tool_name)
        or str(event.kind).replace("_", " ")
    )


def child_ids(
    event: Event,
    call: AgentCall,
    kind: HarnessKind,
) -> tuple[str, ...]:
    provider_children = (
        *call.receiver_thread_ids,
        call.new_thread_id,
        call.agent_id,
        *state_thread_ids(call.states),
    )
    children = tuple(
        dict.fromkeys(item for item in provider_children if nonblank(item))
    )
    if children:
        return children
    if kind is HarnessKind.CODEX:
        return ()
    fallback = nonblank(event.tool_id)
    return (fallback,) if fallback is not None else ()


def state_thread_ids(states: object) -> tuple[str, ...]:
    if not isinstance(states, dict):
        return ()
    return tuple(
        key
        for key in states
        if isinstance(key, str) and len(key) >= 20 and "-" in key
    )


def completion_message(event: Event, call: AgentCall, child: str) -> str:
    states = call.states
    if isinstance(states, dict):
        child_state = states.get(child)
        if isinstance(child_state, dict):
            message = child_state.get("message")
            if isinstance(message, str) and message.strip():
                return message.strip()
    return event_message(event)


def nonblank(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def json_value(value: object) -> JsonValue | None:
    if value is None or isinstance(value, str | int | bool):
        return value
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, tuple | list):
        return [json_value(item) for item in value]
    if isinstance(value, dict):
        return {
            str(key): json_value(item)
            for key, item in value.items()
        }
    return None


def provider_kind(provider: Provider | str) -> HarnessKind:
    return HarnessKind(str(provider))
