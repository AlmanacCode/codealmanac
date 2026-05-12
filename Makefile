HOST ?= 127.0.0.1
PORT ?= 3927
WIKI_DIR ?= $(CURDIR)

.PHONY: build serve

build:
	npm run build

serve: build
	cd "$(WIKI_DIR)" && node "$(CURDIR)/dist/codealmanac.js" serve --host "$(HOST)" --port "$(PORT)"
