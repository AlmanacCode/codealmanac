export interface SplitFlagValue {
  flag: string;
  value?: string;
}

export function splitFlagValue(arg: string): SplitFlagValue {
  const equals = arg.indexOf("=");
  if (equals < 0) return { flag: arg };
  return {
    flag: arg.slice(0, equals),
    value: arg.slice(equals + 1),
  };
}
