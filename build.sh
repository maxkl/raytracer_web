#!/bin/sh

wasm-pack build --target no-modules --out-dir static/pkg "$@"
