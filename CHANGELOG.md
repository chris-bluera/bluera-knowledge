# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [0.11.2](https://github.com/blueraai/bluera-knowledge/compare/v0.10.0...v0.11.2) (2026-01-10)


### Features

* **analysis:** add custom language extensibility framework with ZIL adapter ([c4dc526](https://github.com/blueraai/bluera-knowledge/commit/c4dc526467c70dbc3fb28e7e5d7620a90cc3bf95))
* **sync:** add git-committable store definitions with sync command ([5cfa925](https://github.com/blueraai/bluera-knowledge/commit/5cfa92580397f193fda75ea61197fb4c9d9d4b0a))


### Bug Fixes

* **crawl:** handle Claude CLI structured_output wrapper in intelligent crawl ([54ea74b](https://github.com/blueraai/bluera-knowledge/commit/54ea74bca6d4b7263ef11a8290416e0d66b8d37f))
* **test:** add timeout to flaky search test ([5848b76](https://github.com/blueraai/bluera-knowledge/commit/5848b7648a547510fc2333f283ae835a6ca9efef))

## [0.11.1](https://github.com/blueraai/bluera-knowledge/compare/v0.10.0...v0.11.1) (2026-01-09)


### Features

* **analysis:** add custom language extensibility framework with ZIL adapter ([c4dc526](https://github.com/blueraai/bluera-knowledge/commit/c4dc526467c70dbc3fb28e7e5d7620a90cc3bf95))
* **sync:** add git-committable store definitions with sync command ([5cfa925](https://github.com/blueraai/bluera-knowledge/commit/5cfa92580397f193fda75ea61197fb4c9d9d4b0a))


### Bug Fixes

* **crawl:** handle Claude CLI structured_output wrapper in intelligent crawl ([54ea74b](https://github.com/blueraai/bluera-knowledge/commit/54ea74bca6d4b7263ef11a8290416e0d66b8d37f))

## [0.11.0](https://github.com/blueraai/bluera-knowledge/compare/v0.10.0...v0.11.0) (2026-01-09)


### Features

* **analysis:** add custom language extensibility framework with ZIL adapter ([c4dc526](https://github.com/blueraai/bluera-knowledge/commit/c4dc526467c70dbc3fb28e7e5d7620a90cc3bf95))
* **sync:** add git-committable store definitions with sync command ([5cfa925](https://github.com/blueraai/bluera-knowledge/commit/5cfa92580397f193fda75ea61197fb4c9d9d4b0a))


### Bug Fixes

* **crawl:** handle Claude CLI structured_output wrapper in intelligent crawl ([54ea74b](https://github.com/blueraai/bluera-knowledge/commit/54ea74bca6d4b7263ef11a8290416e0d66b8d37f))

## [0.10.1](https://github.com/blueraai/bluera-knowledge/compare/v0.10.0...v0.10.1) (2026-01-09)


### Features

* **sync:** add git-committable store definitions with sync command ([5cfa925](https://github.com/blueraai/bluera-knowledge/commit/5cfa92580397f193fda75ea61197fb4c9d9d4b0a))


### Bug Fixes

* **crawl:** handle Claude CLI structured_output wrapper in intelligent crawl ([54ea74b](https://github.com/blueraai/bluera-knowledge/commit/54ea74bca6d4b7263ef11a8290416e0d66b8d37f))

## [0.10.0](https://github.com/blueraai/bluera-knowledge/compare/v0.9.32...v0.10.0) (2026-01-09)


### Features

* **search:** add contextual/full detail display and use process.exitCode ([3205859](https://github.com/blueraai/bluera-knowledge/commit/32058590f6375b8564a255901333536183aa1bd2))
* **search:** add raw score exposure, confidence levels, and minRelevance filtering ([dc45e4d](https://github.com/blueraai/bluera-knowledge/commit/dc45e4d760c526ae5f0ad7912adea0528a61ff05))


### Bug Fixes

* **bridge:** kill Python process before nullifying to prevent zombie ([393dab3](https://github.com/blueraai/bluera-knowledge/commit/393dab3e45c75fd87c9ecfc1ca92e67b14526e79))
* **bridge:** mock kill() emits exit event & attach rejection handlers before stop ([d73c6ca](https://github.com/blueraai/bluera-knowledge/commit/d73c6ca6d640c3d15bd82756cabcda832f9ae245))
* **bridge:** stop() now waits for process to actually exit ([a92de41](https://github.com/blueraai/bluera-knowledge/commit/a92de41c89318fc106f996568ed88505352d5159))
* **cli:** ensure destroyServices runs before process.exit ([22e4267](https://github.com/blueraai/bluera-knowledge/commit/22e4267b7b9f698de3985a89b9c2b10759cfd49c))
* **code-unit:** brace counting now handles strings and comments ([1e857bb](https://github.com/blueraai/bluera-knowledge/commit/1e857bb297f357b97a6c067950e62495b3c8fc99))
* **code-unit:** support complex return types in signature extraction ([3bd2467](https://github.com/blueraai/bluera-knowledge/commit/3bd24675a67e73cc74a0c718f4b5a9e86cd826fb))
* **crawl:** improve link discovery for modern documentation sites ([78e1c22](https://github.com/blueraai/bluera-knowledge/commit/78e1c22f9de59131b0ec880f1b5e50b13129d6c0))
* increase native cleanup delays to prevent mutex crashes ([43566ed](https://github.com/blueraai/bluera-knowledge/commit/43566edc301a5093b9bc2000293c7dc0c538b0f0))
* **job:** validate PID before process.kill to prevent process group kill ([67c540f](https://github.com/blueraai/bluera-knowledge/commit/67c540fef6f2c55c5dca2c824104a91fe19aeff1))
* **plugin:** remove redundant hooks reference ([58ee578](https://github.com/blueraai/bluera-knowledge/commit/58ee578a54ae246db68187c4dc06e0a6d2b6c843))
* **plugin:** use .mcp.json instead of inline mcpServers ([ae2e844](https://github.com/blueraai/bluera-knowledge/commit/ae2e844371e1387bc124f1d0f9aa295f70f23440))
* **scripts:** preserve test exit codes in piped commands ([865f491](https://github.com/blueraai/bluera-knowledge/commit/865f491858ef518fb74f3d7dfed269109cd62c72))
* **search:** apply threshold filtering after score normalization ([1ebc78e](https://github.com/blueraai/bluera-knowledge/commit/1ebc78e0e688ffde0fdbaf049f17a35d129ef055))
* **search:** enable FTS-only search mode ([4a0f371](https://github.com/blueraai/bluera-knowledge/commit/4a0f371f0c42f80bf87e28ae0e609ac95986964d))
* **services:** fail fast on corrupted config/registry files ([030f63c](https://github.com/blueraai/bluera-knowledge/commit/030f63c10b0a30bddcd8e9b27b291ab0f53263f1))
* **tests:** increase timeout for exit code test in CI ([a362dcd](https://github.com/blueraai/bluera-knowledge/commit/a362dcdae32b0c19e757270e5009b0c1c5ead4e4))
* **tests:** increase timeout for flaky store delete test ([738fb49](https://github.com/blueraai/bluera-knowledge/commit/738fb4975653703d800dee802730dedfdf9e85ba))
* **watch:** clear pending timeouts on unwatch to prevent timer leak ([4dcafc1](https://github.com/blueraai/bluera-knowledge/commit/4dcafc14417442f6eeed0257cf185e04ae9de12b))
* **worker:** fail fast on PID file write error ([d92ce42](https://github.com/blueraai/bluera-knowledge/commit/d92ce42eff63cee3c97056ef019f5a52ef699edd))
* **worker:** prevent division by zero and improve cancellation handling ([b7b40ab](https://github.com/blueraai/bluera-knowledge/commit/b7b40ab950b7ad0fbbe84af243be3138b1072a72))

## [0.9.44](https://github.com/blueraai/bluera-knowledge/compare/v0.9.32...v0.9.44) (2026-01-09)


### Features

* **search:** add contextual/full detail display and use process.exitCode ([3205859](https://github.com/blueraai/bluera-knowledge/commit/32058590f6375b8564a255901333536183aa1bd2))
* **search:** add raw score exposure, confidence levels, and minRelevance filtering ([dc45e4d](https://github.com/blueraai/bluera-knowledge/commit/dc45e4d760c526ae5f0ad7912adea0528a61ff05))


### Bug Fixes

* **bridge:** kill Python process before nullifying to prevent zombie ([393dab3](https://github.com/blueraai/bluera-knowledge/commit/393dab3e45c75fd87c9ecfc1ca92e67b14526e79))
* **bridge:** mock kill() emits exit event & attach rejection handlers before stop ([d73c6ca](https://github.com/blueraai/bluera-knowledge/commit/d73c6ca6d640c3d15bd82756cabcda832f9ae245))
* **bridge:** stop() now waits for process to actually exit ([a92de41](https://github.com/blueraai/bluera-knowledge/commit/a92de41c89318fc106f996568ed88505352d5159))
* **cli:** ensure destroyServices runs before process.exit ([22e4267](https://github.com/blueraai/bluera-knowledge/commit/22e4267b7b9f698de3985a89b9c2b10759cfd49c))
* **code-unit:** brace counting now handles strings and comments ([1e857bb](https://github.com/blueraai/bluera-knowledge/commit/1e857bb297f357b97a6c067950e62495b3c8fc99))
* **code-unit:** support complex return types in signature extraction ([3bd2467](https://github.com/blueraai/bluera-knowledge/commit/3bd24675a67e73cc74a0c718f4b5a9e86cd826fb))
* increase native cleanup delays to prevent mutex crashes ([43566ed](https://github.com/blueraai/bluera-knowledge/commit/43566edc301a5093b9bc2000293c7dc0c538b0f0))
* **job:** validate PID before process.kill to prevent process group kill ([67c540f](https://github.com/blueraai/bluera-knowledge/commit/67c540fef6f2c55c5dca2c824104a91fe19aeff1))
* **plugin:** remove redundant hooks reference ([58ee578](https://github.com/blueraai/bluera-knowledge/commit/58ee578a54ae246db68187c4dc06e0a6d2b6c843))
* **plugin:** use .mcp.json instead of inline mcpServers ([ae2e844](https://github.com/blueraai/bluera-knowledge/commit/ae2e844371e1387bc124f1d0f9aa295f70f23440))
* **scripts:** preserve test exit codes in piped commands ([865f491](https://github.com/blueraai/bluera-knowledge/commit/865f491858ef518fb74f3d7dfed269109cd62c72))
* **search:** apply threshold filtering after score normalization ([1ebc78e](https://github.com/blueraai/bluera-knowledge/commit/1ebc78e0e688ffde0fdbaf049f17a35d129ef055))
* **search:** enable FTS-only search mode ([4a0f371](https://github.com/blueraai/bluera-knowledge/commit/4a0f371f0c42f80bf87e28ae0e609ac95986964d))
* **services:** fail fast on corrupted config/registry files ([030f63c](https://github.com/blueraai/bluera-knowledge/commit/030f63c10b0a30bddcd8e9b27b291ab0f53263f1))
* **tests:** increase timeout for exit code test in CI ([a362dcd](https://github.com/blueraai/bluera-knowledge/commit/a362dcdae32b0c19e757270e5009b0c1c5ead4e4))
* **tests:** increase timeout for flaky store delete test ([738fb49](https://github.com/blueraai/bluera-knowledge/commit/738fb4975653703d800dee802730dedfdf9e85ba))
* **watch:** clear pending timeouts on unwatch to prevent timer leak ([4dcafc1](https://github.com/blueraai/bluera-knowledge/commit/4dcafc14417442f6eeed0257cf185e04ae9de12b))
* **worker:** fail fast on PID file write error ([d92ce42](https://github.com/blueraai/bluera-knowledge/commit/d92ce42eff63cee3c97056ef019f5a52ef699edd))
* **worker:** prevent division by zero and improve cancellation handling ([b7b40ab](https://github.com/blueraai/bluera-knowledge/commit/b7b40ab950b7ad0fbbe84af243be3138b1072a72))

## [0.9.43](https://github.com/blueraai/bluera-knowledge/compare/v0.9.32...v0.9.43) (2026-01-09)


### Features

* **search:** add contextual/full detail display and use process.exitCode ([3205859](https://github.com/blueraai/bluera-knowledge/commit/32058590f6375b8564a255901333536183aa1bd2))
* **search:** add raw score exposure, confidence levels, and minRelevance filtering ([dc45e4d](https://github.com/blueraai/bluera-knowledge/commit/dc45e4d760c526ae5f0ad7912adea0528a61ff05))


### Bug Fixes

* **bridge:** kill Python process before nullifying to prevent zombie ([393dab3](https://github.com/blueraai/bluera-knowledge/commit/393dab3e45c75fd87c9ecfc1ca92e67b14526e79))
* **bridge:** mock kill() emits exit event & attach rejection handlers before stop ([d73c6ca](https://github.com/blueraai/bluera-knowledge/commit/d73c6ca6d640c3d15bd82756cabcda832f9ae245))
* **bridge:** stop() now waits for process to actually exit ([a92de41](https://github.com/blueraai/bluera-knowledge/commit/a92de41c89318fc106f996568ed88505352d5159))
* **cli:** ensure destroyServices runs before process.exit ([22e4267](https://github.com/blueraai/bluera-knowledge/commit/22e4267b7b9f698de3985a89b9c2b10759cfd49c))
* **code-unit:** brace counting now handles strings and comments ([1e857bb](https://github.com/blueraai/bluera-knowledge/commit/1e857bb297f357b97a6c067950e62495b3c8fc99))
* **code-unit:** support complex return types in signature extraction ([3bd2467](https://github.com/blueraai/bluera-knowledge/commit/3bd24675a67e73cc74a0c718f4b5a9e86cd826fb))
* increase native cleanup delays to prevent mutex crashes ([43566ed](https://github.com/blueraai/bluera-knowledge/commit/43566edc301a5093b9bc2000293c7dc0c538b0f0))
* **job:** validate PID before process.kill to prevent process group kill ([67c540f](https://github.com/blueraai/bluera-knowledge/commit/67c540fef6f2c55c5dca2c824104a91fe19aeff1))
* **plugin:** remove redundant hooks reference ([58ee578](https://github.com/blueraai/bluera-knowledge/commit/58ee578a54ae246db68187c4dc06e0a6d2b6c843))
* **scripts:** preserve test exit codes in piped commands ([865f491](https://github.com/blueraai/bluera-knowledge/commit/865f491858ef518fb74f3d7dfed269109cd62c72))
* **search:** apply threshold filtering after score normalization ([1ebc78e](https://github.com/blueraai/bluera-knowledge/commit/1ebc78e0e688ffde0fdbaf049f17a35d129ef055))
* **search:** enable FTS-only search mode ([4a0f371](https://github.com/blueraai/bluera-knowledge/commit/4a0f371f0c42f80bf87e28ae0e609ac95986964d))
* **services:** fail fast on corrupted config/registry files ([030f63c](https://github.com/blueraai/bluera-knowledge/commit/030f63c10b0a30bddcd8e9b27b291ab0f53263f1))
* **tests:** increase timeout for exit code test in CI ([a362dcd](https://github.com/blueraai/bluera-knowledge/commit/a362dcdae32b0c19e757270e5009b0c1c5ead4e4))
* **tests:** increase timeout for flaky store delete test ([738fb49](https://github.com/blueraai/bluera-knowledge/commit/738fb4975653703d800dee802730dedfdf9e85ba))
* **watch:** clear pending timeouts on unwatch to prevent timer leak ([4dcafc1](https://github.com/blueraai/bluera-knowledge/commit/4dcafc14417442f6eeed0257cf185e04ae9de12b))
* **worker:** fail fast on PID file write error ([d92ce42](https://github.com/blueraai/bluera-knowledge/commit/d92ce42eff63cee3c97056ef019f5a52ef699edd))
* **worker:** prevent division by zero and improve cancellation handling ([b7b40ab](https://github.com/blueraai/bluera-knowledge/commit/b7b40ab950b7ad0fbbe84af243be3138b1072a72))

## [0.9.42](https://github.com/blueraai/bluera-knowledge/compare/v0.9.32...v0.9.42) (2026-01-09)


### Features

* **search:** add contextual/full detail display and use process.exitCode ([3205859](https://github.com/blueraai/bluera-knowledge/commit/32058590f6375b8564a255901333536183aa1bd2))
* **search:** add raw score exposure, confidence levels, and minRelevance filtering ([dc45e4d](https://github.com/blueraai/bluera-knowledge/commit/dc45e4d760c526ae5f0ad7912adea0528a61ff05))


### Bug Fixes

* **bridge:** kill Python process before nullifying to prevent zombie ([393dab3](https://github.com/blueraai/bluera-knowledge/commit/393dab3e45c75fd87c9ecfc1ca92e67b14526e79))
* **bridge:** mock kill() emits exit event & attach rejection handlers before stop ([d73c6ca](https://github.com/blueraai/bluera-knowledge/commit/d73c6ca6d640c3d15bd82756cabcda832f9ae245))
* **bridge:** stop() now waits for process to actually exit ([a92de41](https://github.com/blueraai/bluera-knowledge/commit/a92de41c89318fc106f996568ed88505352d5159))
* **cli:** ensure destroyServices runs before process.exit ([22e4267](https://github.com/blueraai/bluera-knowledge/commit/22e4267b7b9f698de3985a89b9c2b10759cfd49c))
* **code-unit:** brace counting now handles strings and comments ([1e857bb](https://github.com/blueraai/bluera-knowledge/commit/1e857bb297f357b97a6c067950e62495b3c8fc99))
* **code-unit:** support complex return types in signature extraction ([3bd2467](https://github.com/blueraai/bluera-knowledge/commit/3bd24675a67e73cc74a0c718f4b5a9e86cd826fb))
* increase native cleanup delays to prevent mutex crashes ([43566ed](https://github.com/blueraai/bluera-knowledge/commit/43566edc301a5093b9bc2000293c7dc0c538b0f0))
* **job:** validate PID before process.kill to prevent process group kill ([67c540f](https://github.com/blueraai/bluera-knowledge/commit/67c540fef6f2c55c5dca2c824104a91fe19aeff1))
* **scripts:** preserve test exit codes in piped commands ([865f491](https://github.com/blueraai/bluera-knowledge/commit/865f491858ef518fb74f3d7dfed269109cd62c72))
* **search:** apply threshold filtering after score normalization ([1ebc78e](https://github.com/blueraai/bluera-knowledge/commit/1ebc78e0e688ffde0fdbaf049f17a35d129ef055))
* **search:** enable FTS-only search mode ([4a0f371](https://github.com/blueraai/bluera-knowledge/commit/4a0f371f0c42f80bf87e28ae0e609ac95986964d))
* **services:** fail fast on corrupted config/registry files ([030f63c](https://github.com/blueraai/bluera-knowledge/commit/030f63c10b0a30bddcd8e9b27b291ab0f53263f1))
* **tests:** increase timeout for exit code test in CI ([a362dcd](https://github.com/blueraai/bluera-knowledge/commit/a362dcdae32b0c19e757270e5009b0c1c5ead4e4))
* **tests:** increase timeout for flaky store delete test ([738fb49](https://github.com/blueraai/bluera-knowledge/commit/738fb4975653703d800dee802730dedfdf9e85ba))
* **watch:** clear pending timeouts on unwatch to prevent timer leak ([4dcafc1](https://github.com/blueraai/bluera-knowledge/commit/4dcafc14417442f6eeed0257cf185e04ae9de12b))
* **worker:** fail fast on PID file write error ([d92ce42](https://github.com/blueraai/bluera-knowledge/commit/d92ce42eff63cee3c97056ef019f5a52ef699edd))
* **worker:** prevent division by zero and improve cancellation handling ([b7b40ab](https://github.com/blueraai/bluera-knowledge/commit/b7b40ab950b7ad0fbbe84af243be3138b1072a72))

## [0.9.41](https://github.com/blueraai/bluera-knowledge/compare/v0.9.32...v0.9.41) (2026-01-09)


### Features

* **search:** add contextual/full detail display and use process.exitCode ([3205859](https://github.com/blueraai/bluera-knowledge/commit/32058590f6375b8564a255901333536183aa1bd2))
* **search:** add raw score exposure, confidence levels, and minRelevance filtering ([dc45e4d](https://github.com/blueraai/bluera-knowledge/commit/dc45e4d760c526ae5f0ad7912adea0528a61ff05))


### Bug Fixes

* **bridge:** kill Python process before nullifying to prevent zombie ([393dab3](https://github.com/blueraai/bluera-knowledge/commit/393dab3e45c75fd87c9ecfc1ca92e67b14526e79))
* **bridge:** mock kill() emits exit event & attach rejection handlers before stop ([d73c6ca](https://github.com/blueraai/bluera-knowledge/commit/d73c6ca6d640c3d15bd82756cabcda832f9ae245))
* **bridge:** stop() now waits for process to actually exit ([a92de41](https://github.com/blueraai/bluera-knowledge/commit/a92de41c89318fc106f996568ed88505352d5159))
* **cli:** ensure destroyServices runs before process.exit ([22e4267](https://github.com/blueraai/bluera-knowledge/commit/22e4267b7b9f698de3985a89b9c2b10759cfd49c))
* **code-unit:** brace counting now handles strings and comments ([1e857bb](https://github.com/blueraai/bluera-knowledge/commit/1e857bb297f357b97a6c067950e62495b3c8fc99))
* **code-unit:** support complex return types in signature extraction ([3bd2467](https://github.com/blueraai/bluera-knowledge/commit/3bd24675a67e73cc74a0c718f4b5a9e86cd826fb))
* increase native cleanup delays to prevent mutex crashes ([43566ed](https://github.com/blueraai/bluera-knowledge/commit/43566edc301a5093b9bc2000293c7dc0c538b0f0))
* **job:** validate PID before process.kill to prevent process group kill ([67c540f](https://github.com/blueraai/bluera-knowledge/commit/67c540fef6f2c55c5dca2c824104a91fe19aeff1))
* **scripts:** preserve test exit codes in piped commands ([865f491](https://github.com/blueraai/bluera-knowledge/commit/865f491858ef518fb74f3d7dfed269109cd62c72))
* **search:** apply threshold filtering after score normalization ([1ebc78e](https://github.com/blueraai/bluera-knowledge/commit/1ebc78e0e688ffde0fdbaf049f17a35d129ef055))
* **search:** enable FTS-only search mode ([4a0f371](https://github.com/blueraai/bluera-knowledge/commit/4a0f371f0c42f80bf87e28ae0e609ac95986964d))
* **services:** fail fast on corrupted config/registry files ([030f63c](https://github.com/blueraai/bluera-knowledge/commit/030f63c10b0a30bddcd8e9b27b291ab0f53263f1))
* **tests:** increase timeout for exit code test in CI ([a362dcd](https://github.com/blueraai/bluera-knowledge/commit/a362dcdae32b0c19e757270e5009b0c1c5ead4e4))
* **tests:** increase timeout for flaky store delete test ([738fb49](https://github.com/blueraai/bluera-knowledge/commit/738fb4975653703d800dee802730dedfdf9e85ba))
* **watch:** clear pending timeouts on unwatch to prevent timer leak ([4dcafc1](https://github.com/blueraai/bluera-knowledge/commit/4dcafc14417442f6eeed0257cf185e04ae9de12b))
* **worker:** fail fast on PID file write error ([d92ce42](https://github.com/blueraai/bluera-knowledge/commit/d92ce42eff63cee3c97056ef019f5a52ef699edd))
* **worker:** prevent division by zero and improve cancellation handling ([b7b40ab](https://github.com/blueraai/bluera-knowledge/commit/b7b40ab950b7ad0fbbe84af243be3138b1072a72))

## [0.9.40](https://github.com/blueraai/bluera-knowledge/compare/v0.9.32...v0.9.40) (2026-01-08)


### Features

* **search:** add raw score exposure, confidence levels, and minRelevance filtering ([dc45e4d](https://github.com/blueraai/bluera-knowledge/commit/dc45e4d760c526ae5f0ad7912adea0528a61ff05))


### Bug Fixes

* **bridge:** kill Python process before nullifying to prevent zombie ([393dab3](https://github.com/blueraai/bluera-knowledge/commit/393dab3e45c75fd87c9ecfc1ca92e67b14526e79))
* **bridge:** mock kill() emits exit event & attach rejection handlers before stop ([d73c6ca](https://github.com/blueraai/bluera-knowledge/commit/d73c6ca6d640c3d15bd82756cabcda832f9ae245))
* **bridge:** stop() now waits for process to actually exit ([a92de41](https://github.com/blueraai/bluera-knowledge/commit/a92de41c89318fc106f996568ed88505352d5159))
* **cli:** ensure destroyServices runs before process.exit ([22e4267](https://github.com/blueraai/bluera-knowledge/commit/22e4267b7b9f698de3985a89b9c2b10759cfd49c))
* **code-unit:** brace counting now handles strings and comments ([1e857bb](https://github.com/blueraai/bluera-knowledge/commit/1e857bb297f357b97a6c067950e62495b3c8fc99))
* **code-unit:** support complex return types in signature extraction ([3bd2467](https://github.com/blueraai/bluera-knowledge/commit/3bd24675a67e73cc74a0c718f4b5a9e86cd826fb))
* **job:** validate PID before process.kill to prevent process group kill ([67c540f](https://github.com/blueraai/bluera-knowledge/commit/67c540fef6f2c55c5dca2c824104a91fe19aeff1))
* **scripts:** preserve test exit codes in piped commands ([865f491](https://github.com/blueraai/bluera-knowledge/commit/865f491858ef518fb74f3d7dfed269109cd62c72))
* **search:** apply threshold filtering after score normalization ([1ebc78e](https://github.com/blueraai/bluera-knowledge/commit/1ebc78e0e688ffde0fdbaf049f17a35d129ef055))
* **search:** enable FTS-only search mode ([4a0f371](https://github.com/blueraai/bluera-knowledge/commit/4a0f371f0c42f80bf87e28ae0e609ac95986964d))
* **services:** fail fast on corrupted config/registry files ([030f63c](https://github.com/blueraai/bluera-knowledge/commit/030f63c10b0a30bddcd8e9b27b291ab0f53263f1))
* **tests:** increase timeout for exit code test in CI ([a362dcd](https://github.com/blueraai/bluera-knowledge/commit/a362dcdae32b0c19e757270e5009b0c1c5ead4e4))
* **tests:** increase timeout for flaky store delete test ([738fb49](https://github.com/blueraai/bluera-knowledge/commit/738fb4975653703d800dee802730dedfdf9e85ba))
* **watch:** clear pending timeouts on unwatch to prevent timer leak ([4dcafc1](https://github.com/blueraai/bluera-knowledge/commit/4dcafc14417442f6eeed0257cf185e04ae9de12b))
* **worker:** fail fast on PID file write error ([d92ce42](https://github.com/blueraai/bluera-knowledge/commit/d92ce42eff63cee3c97056ef019f5a52ef699edd))
* **worker:** prevent division by zero and improve cancellation handling ([b7b40ab](https://github.com/blueraai/bluera-knowledge/commit/b7b40ab950b7ad0fbbe84af243be3138b1072a72))

## [0.9.39](https://github.com/blueraai/bluera-knowledge/compare/v0.9.32...v0.9.39) (2026-01-08)


### Features

* **search:** add raw score exposure, confidence levels, and minRelevance filtering ([dc45e4d](https://github.com/blueraai/bluera-knowledge/commit/dc45e4d760c526ae5f0ad7912adea0528a61ff05))


### Bug Fixes

* **bridge:** kill Python process before nullifying to prevent zombie ([393dab3](https://github.com/blueraai/bluera-knowledge/commit/393dab3e45c75fd87c9ecfc1ca92e67b14526e79))
* **bridge:** mock kill() emits exit event & attach rejection handlers before stop ([d73c6ca](https://github.com/blueraai/bluera-knowledge/commit/d73c6ca6d640c3d15bd82756cabcda832f9ae245))
* **bridge:** stop() now waits for process to actually exit ([a92de41](https://github.com/blueraai/bluera-knowledge/commit/a92de41c89318fc106f996568ed88505352d5159))
* **cli:** ensure destroyServices runs before process.exit ([22e4267](https://github.com/blueraai/bluera-knowledge/commit/22e4267b7b9f698de3985a89b9c2b10759cfd49c))
* **code-unit:** brace counting now handles strings and comments ([1e857bb](https://github.com/blueraai/bluera-knowledge/commit/1e857bb297f357b97a6c067950e62495b3c8fc99))
* **code-unit:** support complex return types in signature extraction ([3bd2467](https://github.com/blueraai/bluera-knowledge/commit/3bd24675a67e73cc74a0c718f4b5a9e86cd826fb))
* **job:** validate PID before process.kill to prevent process group kill ([67c540f](https://github.com/blueraai/bluera-knowledge/commit/67c540fef6f2c55c5dca2c824104a91fe19aeff1))
* **search:** apply threshold filtering after score normalization ([1ebc78e](https://github.com/blueraai/bluera-knowledge/commit/1ebc78e0e688ffde0fdbaf049f17a35d129ef055))
* **search:** enable FTS-only search mode ([4a0f371](https://github.com/blueraai/bluera-knowledge/commit/4a0f371f0c42f80bf87e28ae0e609ac95986964d))
* **services:** fail fast on corrupted config/registry files ([030f63c](https://github.com/blueraai/bluera-knowledge/commit/030f63c10b0a30bddcd8e9b27b291ab0f53263f1))
* **tests:** increase timeout for exit code test in CI ([a362dcd](https://github.com/blueraai/bluera-knowledge/commit/a362dcdae32b0c19e757270e5009b0c1c5ead4e4))
* **tests:** increase timeout for flaky store delete test ([738fb49](https://github.com/blueraai/bluera-knowledge/commit/738fb4975653703d800dee802730dedfdf9e85ba))
* **watch:** clear pending timeouts on unwatch to prevent timer leak ([4dcafc1](https://github.com/blueraai/bluera-knowledge/commit/4dcafc14417442f6eeed0257cf185e04ae9de12b))
* **worker:** fail fast on PID file write error ([d92ce42](https://github.com/blueraai/bluera-knowledge/commit/d92ce42eff63cee3c97056ef019f5a52ef699edd))
* **worker:** prevent division by zero and improve cancellation handling ([b7b40ab](https://github.com/blueraai/bluera-knowledge/commit/b7b40ab950b7ad0fbbe84af243be3138b1072a72))

## [0.9.38](https://github.com/blueraai/bluera-knowledge/compare/v0.9.32...v0.9.38) (2026-01-08)


### Bug Fixes

* **bridge:** kill Python process before nullifying to prevent zombie ([393dab3](https://github.com/blueraai/bluera-knowledge/commit/393dab3e45c75fd87c9ecfc1ca92e67b14526e79))
* **bridge:** mock kill() emits exit event & attach rejection handlers before stop ([d73c6ca](https://github.com/blueraai/bluera-knowledge/commit/d73c6ca6d640c3d15bd82756cabcda832f9ae245))
* **bridge:** stop() now waits for process to actually exit ([a92de41](https://github.com/blueraai/bluera-knowledge/commit/a92de41c89318fc106f996568ed88505352d5159))
* **cli:** ensure destroyServices runs before process.exit ([22e4267](https://github.com/blueraai/bluera-knowledge/commit/22e4267b7b9f698de3985a89b9c2b10759cfd49c))
* **code-unit:** brace counting now handles strings and comments ([1e857bb](https://github.com/blueraai/bluera-knowledge/commit/1e857bb297f357b97a6c067950e62495b3c8fc99))
* **code-unit:** support complex return types in signature extraction ([3bd2467](https://github.com/blueraai/bluera-knowledge/commit/3bd24675a67e73cc74a0c718f4b5a9e86cd826fb))
* **job:** validate PID before process.kill to prevent process group kill ([67c540f](https://github.com/blueraai/bluera-knowledge/commit/67c540fef6f2c55c5dca2c824104a91fe19aeff1))
* **search:** apply threshold filtering after score normalization ([1ebc78e](https://github.com/blueraai/bluera-knowledge/commit/1ebc78e0e688ffde0fdbaf049f17a35d129ef055))
* **search:** enable FTS-only search mode ([4a0f371](https://github.com/blueraai/bluera-knowledge/commit/4a0f371f0c42f80bf87e28ae0e609ac95986964d))
* **services:** fail fast on corrupted config/registry files ([030f63c](https://github.com/blueraai/bluera-knowledge/commit/030f63c10b0a30bddcd8e9b27b291ab0f53263f1))
* **tests:** increase timeout for exit code test in CI ([a362dcd](https://github.com/blueraai/bluera-knowledge/commit/a362dcdae32b0c19e757270e5009b0c1c5ead4e4))
* **tests:** increase timeout for flaky store delete test ([738fb49](https://github.com/blueraai/bluera-knowledge/commit/738fb4975653703d800dee802730dedfdf9e85ba))
* **watch:** clear pending timeouts on unwatch to prevent timer leak ([4dcafc1](https://github.com/blueraai/bluera-knowledge/commit/4dcafc14417442f6eeed0257cf185e04ae9de12b))
* **worker:** fail fast on PID file write error ([d92ce42](https://github.com/blueraai/bluera-knowledge/commit/d92ce42eff63cee3c97056ef019f5a52ef699edd))
* **worker:** prevent division by zero and improve cancellation handling ([b7b40ab](https://github.com/blueraai/bluera-knowledge/commit/b7b40ab950b7ad0fbbe84af243be3138b1072a72))

## [0.9.37](https://github.com/blueraai/bluera-knowledge/compare/v0.9.32...v0.9.37) (2026-01-08)


### Bug Fixes

* **bridge:** kill Python process before nullifying to prevent zombie ([393dab3](https://github.com/blueraai/bluera-knowledge/commit/393dab3e45c75fd87c9ecfc1ca92e67b14526e79))
* **bridge:** mock kill() emits exit event & attach rejection handlers before stop ([d73c6ca](https://github.com/blueraai/bluera-knowledge/commit/d73c6ca6d640c3d15bd82756cabcda832f9ae245))
* **bridge:** stop() now waits for process to actually exit ([a92de41](https://github.com/blueraai/bluera-knowledge/commit/a92de41c89318fc106f996568ed88505352d5159))
* **cli:** ensure destroyServices runs before process.exit ([22e4267](https://github.com/blueraai/bluera-knowledge/commit/22e4267b7b9f698de3985a89b9c2b10759cfd49c))
* **code-unit:** brace counting now handles strings and comments ([1e857bb](https://github.com/blueraai/bluera-knowledge/commit/1e857bb297f357b97a6c067950e62495b3c8fc99))
* **code-unit:** support complex return types in signature extraction ([3bd2467](https://github.com/blueraai/bluera-knowledge/commit/3bd24675a67e73cc74a0c718f4b5a9e86cd826fb))
* **job:** validate PID before process.kill to prevent process group kill ([67c540f](https://github.com/blueraai/bluera-knowledge/commit/67c540fef6f2c55c5dca2c824104a91fe19aeff1))
* **search:** apply threshold filtering after score normalization ([1ebc78e](https://github.com/blueraai/bluera-knowledge/commit/1ebc78e0e688ffde0fdbaf049f17a35d129ef055))
* **services:** fail fast on corrupted config/registry files ([030f63c](https://github.com/blueraai/bluera-knowledge/commit/030f63c10b0a30bddcd8e9b27b291ab0f53263f1))
* **tests:** increase timeout for exit code test in CI ([a362dcd](https://github.com/blueraai/bluera-knowledge/commit/a362dcdae32b0c19e757270e5009b0c1c5ead4e4))
* **tests:** increase timeout for flaky store delete test ([738fb49](https://github.com/blueraai/bluera-knowledge/commit/738fb4975653703d800dee802730dedfdf9e85ba))
* **watch:** clear pending timeouts on unwatch to prevent timer leak ([4dcafc1](https://github.com/blueraai/bluera-knowledge/commit/4dcafc14417442f6eeed0257cf185e04ae9de12b))
* **worker:** fail fast on PID file write error ([d92ce42](https://github.com/blueraai/bluera-knowledge/commit/d92ce42eff63cee3c97056ef019f5a52ef699edd))
* **worker:** prevent division by zero and improve cancellation handling ([b7b40ab](https://github.com/blueraai/bluera-knowledge/commit/b7b40ab950b7ad0fbbe84af243be3138b1072a72))

## [0.9.36](https://github.com/blueraai/bluera-knowledge/compare/v0.9.32...v0.9.36) (2026-01-08)


### Bug Fixes

* **bridge:** kill Python process before nullifying to prevent zombie ([393dab3](https://github.com/blueraai/bluera-knowledge/commit/393dab3e45c75fd87c9ecfc1ca92e67b14526e79))
* **bridge:** mock kill() emits exit event & attach rejection handlers before stop ([d73c6ca](https://github.com/blueraai/bluera-knowledge/commit/d73c6ca6d640c3d15bd82756cabcda832f9ae245))
* **bridge:** stop() now waits for process to actually exit ([a92de41](https://github.com/blueraai/bluera-knowledge/commit/a92de41c89318fc106f996568ed88505352d5159))
* **cli:** ensure destroyServices runs before process.exit ([22e4267](https://github.com/blueraai/bluera-knowledge/commit/22e4267b7b9f698de3985a89b9c2b10759cfd49c))
* **code-unit:** brace counting now handles strings and comments ([1e857bb](https://github.com/blueraai/bluera-knowledge/commit/1e857bb297f357b97a6c067950e62495b3c8fc99))
* **code-unit:** support complex return types in signature extraction ([3bd2467](https://github.com/blueraai/bluera-knowledge/commit/3bd24675a67e73cc74a0c718f4b5a9e86cd826fb))
* **job:** validate PID before process.kill to prevent process group kill ([67c540f](https://github.com/blueraai/bluera-knowledge/commit/67c540fef6f2c55c5dca2c824104a91fe19aeff1))
* **services:** fail fast on corrupted config/registry files ([030f63c](https://github.com/blueraai/bluera-knowledge/commit/030f63c10b0a30bddcd8e9b27b291ab0f53263f1))
* **tests:** increase timeout for exit code test in CI ([a362dcd](https://github.com/blueraai/bluera-knowledge/commit/a362dcdae32b0c19e757270e5009b0c1c5ead4e4))
* **tests:** increase timeout for flaky store delete test ([738fb49](https://github.com/blueraai/bluera-knowledge/commit/738fb4975653703d800dee802730dedfdf9e85ba))
* **watch:** clear pending timeouts on unwatch to prevent timer leak ([4dcafc1](https://github.com/blueraai/bluera-knowledge/commit/4dcafc14417442f6eeed0257cf185e04ae9de12b))
* **worker:** fail fast on PID file write error ([d92ce42](https://github.com/blueraai/bluera-knowledge/commit/d92ce42eff63cee3c97056ef019f5a52ef699edd))
* **worker:** prevent division by zero and improve cancellation handling ([b7b40ab](https://github.com/blueraai/bluera-knowledge/commit/b7b40ab950b7ad0fbbe84af243be3138b1072a72))

## [0.9.35](https://github.com/blueraai/bluera-knowledge/compare/v0.9.32...v0.9.35) (2026-01-08)


### Bug Fixes

* **bridge:** kill Python process before nullifying to prevent zombie ([393dab3](https://github.com/blueraai/bluera-knowledge/commit/393dab3e45c75fd87c9ecfc1ca92e67b14526e79))
* **bridge:** mock kill() emits exit event & attach rejection handlers before stop ([d73c6ca](https://github.com/blueraai/bluera-knowledge/commit/d73c6ca6d640c3d15bd82756cabcda832f9ae245))
* **bridge:** stop() now waits for process to actually exit ([a92de41](https://github.com/blueraai/bluera-knowledge/commit/a92de41c89318fc106f996568ed88505352d5159))
* **cli:** ensure destroyServices runs before process.exit ([22e4267](https://github.com/blueraai/bluera-knowledge/commit/22e4267b7b9f698de3985a89b9c2b10759cfd49c))
* **code-unit:** brace counting now handles strings and comments ([1e857bb](https://github.com/blueraai/bluera-knowledge/commit/1e857bb297f357b97a6c067950e62495b3c8fc99))
* **code-unit:** support complex return types in signature extraction ([3bd2467](https://github.com/blueraai/bluera-knowledge/commit/3bd24675a67e73cc74a0c718f4b5a9e86cd826fb))
* **job:** validate PID before process.kill to prevent process group kill ([67c540f](https://github.com/blueraai/bluera-knowledge/commit/67c540fef6f2c55c5dca2c824104a91fe19aeff1))
* **services:** fail fast on corrupted config/registry files ([030f63c](https://github.com/blueraai/bluera-knowledge/commit/030f63c10b0a30bddcd8e9b27b291ab0f53263f1))
* **tests:** increase timeout for flaky store delete test ([738fb49](https://github.com/blueraai/bluera-knowledge/commit/738fb4975653703d800dee802730dedfdf9e85ba))
* **watch:** clear pending timeouts on unwatch to prevent timer leak ([4dcafc1](https://github.com/blueraai/bluera-knowledge/commit/4dcafc14417442f6eeed0257cf185e04ae9de12b))
* **worker:** fail fast on PID file write error ([d92ce42](https://github.com/blueraai/bluera-knowledge/commit/d92ce42eff63cee3c97056ef019f5a52ef699edd))
* **worker:** prevent division by zero and improve cancellation handling ([b7b40ab](https://github.com/blueraai/bluera-knowledge/commit/b7b40ab950b7ad0fbbe84af243be3138b1072a72))

## [0.9.34](https://github.com/blueraai/bluera-knowledge/compare/v0.9.32...v0.9.34) (2026-01-08)


### Bug Fixes

* **bridge:** kill Python process before nullifying to prevent zombie ([393dab3](https://github.com/blueraai/bluera-knowledge/commit/393dab3e45c75fd87c9ecfc1ca92e67b14526e79))
* **bridge:** mock kill() emits exit event & attach rejection handlers before stop ([d73c6ca](https://github.com/blueraai/bluera-knowledge/commit/d73c6ca6d640c3d15bd82756cabcda832f9ae245))
* **bridge:** stop() now waits for process to actually exit ([a92de41](https://github.com/blueraai/bluera-knowledge/commit/a92de41c89318fc106f996568ed88505352d5159))
* **cli:** ensure destroyServices runs before process.exit ([22e4267](https://github.com/blueraai/bluera-knowledge/commit/22e4267b7b9f698de3985a89b9c2b10759cfd49c))
* **code-unit:** brace counting now handles strings and comments ([1e857bb](https://github.com/blueraai/bluera-knowledge/commit/1e857bb297f357b97a6c067950e62495b3c8fc99))
* **code-unit:** support complex return types in signature extraction ([3bd2467](https://github.com/blueraai/bluera-knowledge/commit/3bd24675a67e73cc74a0c718f4b5a9e86cd826fb))
* **job:** validate PID before process.kill to prevent process group kill ([67c540f](https://github.com/blueraai/bluera-knowledge/commit/67c540fef6f2c55c5dca2c824104a91fe19aeff1))
* **services:** fail fast on corrupted config/registry files ([030f63c](https://github.com/blueraai/bluera-knowledge/commit/030f63c10b0a30bddcd8e9b27b291ab0f53263f1))
* **tests:** increase timeout for flaky store delete test ([738fb49](https://github.com/blueraai/bluera-knowledge/commit/738fb4975653703d800dee802730dedfdf9e85ba))
* **watch:** clear pending timeouts on unwatch to prevent timer leak ([4dcafc1](https://github.com/blueraai/bluera-knowledge/commit/4dcafc14417442f6eeed0257cf185e04ae9de12b))
* **worker:** prevent division by zero and improve cancellation handling ([b7b40ab](https://github.com/blueraai/bluera-knowledge/commit/b7b40ab950b7ad0fbbe84af243be3138b1072a72))

## [0.9.33](https://github.com/blueraai/bluera-knowledge/compare/v0.9.32...v0.9.33) (2026-01-08)


### Bug Fixes

* **bridge:** kill Python process before nullifying to prevent zombie ([393dab3](https://github.com/blueraai/bluera-knowledge/commit/393dab3e45c75fd87c9ecfc1ca92e67b14526e79))
* **bridge:** mock kill() emits exit event & attach rejection handlers before stop ([d73c6ca](https://github.com/blueraai/bluera-knowledge/commit/d73c6ca6d640c3d15bd82756cabcda832f9ae245))
* **bridge:** stop() now waits for process to actually exit ([a92de41](https://github.com/blueraai/bluera-knowledge/commit/a92de41c89318fc106f996568ed88505352d5159))
* **cli:** ensure destroyServices runs before process.exit ([22e4267](https://github.com/blueraai/bluera-knowledge/commit/22e4267b7b9f698de3985a89b9c2b10759cfd49c))
* **code-unit:** brace counting now handles strings and comments ([1e857bb](https://github.com/blueraai/bluera-knowledge/commit/1e857bb297f357b97a6c067950e62495b3c8fc99))
* **code-unit:** support complex return types in signature extraction ([3bd2467](https://github.com/blueraai/bluera-knowledge/commit/3bd24675a67e73cc74a0c718f4b5a9e86cd826fb))
* **job:** validate PID before process.kill to prevent process group kill ([67c540f](https://github.com/blueraai/bluera-knowledge/commit/67c540fef6f2c55c5dca2c824104a91fe19aeff1))
* **services:** fail fast on corrupted config/registry files ([030f63c](https://github.com/blueraai/bluera-knowledge/commit/030f63c10b0a30bddcd8e9b27b291ab0f53263f1))
* **watch:** clear pending timeouts on unwatch to prevent timer leak ([4dcafc1](https://github.com/blueraai/bluera-knowledge/commit/4dcafc14417442f6eeed0257cf185e04ae9de12b))
* **worker:** prevent division by zero and improve cancellation handling ([b7b40ab](https://github.com/blueraai/bluera-knowledge/commit/b7b40ab950b7ad0fbbe84af243be3138b1072a72))

## [0.9.32](https://github.com/blueraai/bluera-knowledge/compare/v0.9.31...v0.9.32) (2026-01-06)

## [0.9.31](https://github.com/blueraai/bluera-knowledge/compare/v0.9.30...v0.9.31) (2026-01-06)


### Bug Fixes

* address three bugs found during API testing ([862b7e6](https://github.com/blueraai/bluera-knowledge/commit/862b7e67c057c004ae788d9205c147b422339c67)), closes [#1](https://github.com/blueraai/bluera-knowledge/issues/1) [#2](https://github.com/blueraai/bluera-knowledge/issues/2) [#3](https://github.com/blueraai/bluera-knowledge/issues/3)

## [0.9.30](https://github.com/blueraai/bluera-knowledge/compare/v0.9.26...v0.9.30) (2026-01-06)


### Features

* **crawl:** auto-create web store if it doesn't exist ([98face4](https://github.com/blueraai/bluera-knowledge/commit/98face486df69f6d27be9ccca84ce83cbc788de7))
* **logging:** add comprehensive pino-based file logging with auto-rotation ([1f8bc84](https://github.com/blueraai/bluera-knowledge/commit/1f8bc84493b1237d11597aa23312f52d632dcfac))
* **search:** add path keyword boosting for file/folder search ([8771a19](https://github.com/blueraai/bluera-knowledge/commit/8771a19f42c469f7728118deda58de12a0b80db6))
* **search:** add URL keyword matching for improved web search ranking ([17f2e5e](https://github.com/blueraai/bluera-knowledge/commit/17f2e5e55f7d7ce79ac43ad06664cd5056468938))
* **search:** improve search quality for web content ([d2093af](https://github.com/blueraai/bluera-knowledge/commit/d2093af9d36089e3c5ea562be346bc9871477689))
* **search:** increase path/URL keyword boost for better source file ranking ([7f557d3](https://github.com/blueraai/bluera-knowledge/commit/7f557d3973db451b751caf925ad6dd306feed486)), closes [#2](https://github.com/blueraai/bluera-knowledge/issues/2) [#1](https://github.com/blueraai/bluera-knowledge/issues/1)
* **search:** show token usage in MCP search responses ([b4fce10](https://github.com/blueraai/bluera-knowledge/commit/b4fce10c6fce30c493a03da6ff36dd235ae6543d))


### Bug Fixes

* **commands:** resolve skill/command naming collision for /commit ([3b8f854](https://github.com/blueraai/bluera-knowledge/commit/3b8f854caaab9b3390dd66a5e88870ebbd770146))
* **hooks:** capture coverage exit code before filtering output ([e6c72ed](https://github.com/blueraai/bluera-knowledge/commit/e6c72ed9bd149c3291e50b4a4b6eef16e817cad7))
* **hooks:** exit 2 on lint/type errors to block and show to Claude ([8782e8e](https://github.com/blueraai/bluera-knowledge/commit/8782e8ed584298d8f96e08571fbaa1bb9a45c6d7))
* **hooks:** use npx tsc for PATH compatibility ([873b500](https://github.com/blueraai/bluera-knowledge/commit/873b5001e8e27ea676e0124fb1ec6570cef744b1))
* **skills:** add required YAML frontmatter to commit skill ([dbba76d](https://github.com/blueraai/bluera-knowledge/commit/dbba76d5ae01c9d9de2b15c75bfd2756071fb2cd))

## [0.9.29](https://github.com/blueraai/bluera-knowledge/compare/v0.9.26...v0.9.29) (2026-01-06)


### Features

* **crawl:** auto-create web store if it doesn't exist ([98face4](https://github.com/blueraai/bluera-knowledge/commit/98face486df69f6d27be9ccca84ce83cbc788de7))
* **logging:** add comprehensive pino-based file logging with auto-rotation ([1f8bc84](https://github.com/blueraai/bluera-knowledge/commit/1f8bc84493b1237d11597aa23312f52d632dcfac))
* **search:** add path keyword boosting for file/folder search ([8771a19](https://github.com/blueraai/bluera-knowledge/commit/8771a19f42c469f7728118deda58de12a0b80db6))
* **search:** add URL keyword matching for improved web search ranking ([17f2e5e](https://github.com/blueraai/bluera-knowledge/commit/17f2e5e55f7d7ce79ac43ad06664cd5056468938))
* **search:** improve search quality for web content ([d2093af](https://github.com/blueraai/bluera-knowledge/commit/d2093af9d36089e3c5ea562be346bc9871477689))
* **search:** increase path/URL keyword boost for better source file ranking ([7f557d3](https://github.com/blueraai/bluera-knowledge/commit/7f557d3973db451b751caf925ad6dd306feed486)), closes [#2](https://github.com/blueraai/bluera-knowledge/issues/2) [#1](https://github.com/blueraai/bluera-knowledge/issues/1)
* **search:** show token usage in MCP search responses ([b4fce10](https://github.com/blueraai/bluera-knowledge/commit/b4fce10c6fce30c493a03da6ff36dd235ae6543d))


### Bug Fixes

* **hooks:** exit 2 on lint/type errors to block and show to Claude ([8782e8e](https://github.com/blueraai/bluera-knowledge/commit/8782e8ed584298d8f96e08571fbaa1bb9a45c6d7))
* **hooks:** use npx tsc for PATH compatibility ([873b500](https://github.com/blueraai/bluera-knowledge/commit/873b5001e8e27ea676e0124fb1ec6570cef744b1))
* **skills:** add required YAML frontmatter to commit skill ([dbba76d](https://github.com/blueraai/bluera-knowledge/commit/dbba76d5ae01c9d9de2b15c75bfd2756071fb2cd))

## [0.9.28](https://github.com/blueraai/bluera-knowledge/compare/v0.9.26...v0.9.28) (2026-01-06)


### Features

* **logging:** add comprehensive pino-based file logging with auto-rotation ([1f8bc84](https://github.com/blueraai/bluera-knowledge/commit/1f8bc84493b1237d11597aa23312f52d632dcfac))
* **search:** add URL keyword matching for improved web search ranking ([17f2e5e](https://github.com/blueraai/bluera-knowledge/commit/17f2e5e55f7d7ce79ac43ad06664cd5056468938))
* **search:** improve search quality for web content ([d2093af](https://github.com/blueraai/bluera-knowledge/commit/d2093af9d36089e3c5ea562be346bc9871477689))


### Bug Fixes

* **skills:** add required YAML frontmatter to commit skill ([dbba76d](https://github.com/blueraai/bluera-knowledge/commit/dbba76d5ae01c9d9de2b15c75bfd2756071fb2cd))

## [0.9.27](https://github.com/blueraai/bluera-knowledge/compare/v0.9.26...v0.9.27) (2026-01-06)


### Features

* **logging:** add comprehensive pino-based file logging with auto-rotation ([1f8bc84](https://github.com/blueraai/bluera-knowledge/commit/1f8bc84493b1237d11597aa23312f52d632dcfac))
* **search:** improve search quality for web content ([d2093af](https://github.com/blueraai/bluera-knowledge/commit/d2093af9d36089e3c5ea562be346bc9871477689))


### Bug Fixes

* **skills:** add required YAML frontmatter to commit skill ([dbba76d](https://github.com/blueraai/bluera-knowledge/commit/dbba76d5ae01c9d9de2b15c75bfd2756071fb2cd))

## [0.9.26](https://github.com/blueraai/bluera-knowledge/compare/v0.9.25...v0.9.26) (2026-01-06)


### Bug Fixes

* **tests:** make spawn-worker tests more robust ([05e3127](https://github.com/blueraai/bluera-knowledge/commit/05e312748d250592df1ce23395006954907f5387))

## [0.9.25](https://github.com/blueraai/bluera-knowledge/compare/v0.9.23...v0.9.25) (2026-01-06)


### Features

* **ci:** switch to npm trusted publishing (OIDC) ([269c48d](https://github.com/blueraai/bluera-knowledge/commit/269c48d6b04c9e6ebc3c3d77bfe1543f6519c68e))


### Bug Fixes

* **ci:** upgrade npm for trusted publishing support ([9a4a8e0](https://github.com/blueraai/bluera-knowledge/commit/9a4a8e041eb90d549fa5474368c60261e5ed0005))

## [0.9.24](https://github.com/blueraai/bluera-knowledge/compare/v0.9.23...v0.9.24) (2026-01-06)


### Features

* **ci:** switch to npm trusted publishing (OIDC) ([269c48d](https://github.com/blueraai/bluera-knowledge/commit/269c48d6b04c9e6ebc3c3d77bfe1543f6519c68e))

## [0.9.23](https://github.com/blueraai/bluera-knowledge/compare/v0.9.22...v0.9.23) (2026-01-06)

## [0.9.22](https://github.com/blueraai/bluera-knowledge/compare/v0.9.20...v0.9.22) (2026-01-06)

## [0.9.21](https://github.com/blueraai/bluera-knowledge/compare/v0.9.20...v0.9.21) (2026-01-06)

## [0.9.20](https://github.com/blueraai/bluera-knowledge/compare/v0.9.16...v0.9.20) (2026-01-06)


### Features

* **commands:** add CLAUDE.md awareness to commit command ([7c13ac8](https://github.com/blueraai/bluera-knowledge/commit/7c13ac8279db934009eba41705b035c709881fa3))
* **mcp:** consolidate 10 tools into 3 via execute meta-tool ([d59923a](https://github.com/blueraai/bluera-knowledge/commit/d59923ab6a5f29ea5c3f2371e485a12151f9460c))


### Bug Fixes

* **commands:** add explicit README check criteria to commit command ([fb7bd7b](https://github.com/blueraai/bluera-knowledge/commit/fb7bd7bb745b0e92199274185ec6ac8267613c9a))
* **hooks:** make precommit scripts properly fail on errors ([d21c39e](https://github.com/blueraai/bluera-knowledge/commit/d21c39e33c51710107414772a8a9e57a9a386fb1))

## [0.9.19](https://github.com/blueraai/bluera-knowledge/compare/v0.9.16...v0.9.19) (2026-01-06)


### Features

* **commands:** add CLAUDE.md awareness to commit command ([7c13ac8](https://github.com/blueraai/bluera-knowledge/commit/7c13ac8279db934009eba41705b035c709881fa3))
* **mcp:** consolidate 10 tools into 3 via execute meta-tool ([d59923a](https://github.com/blueraai/bluera-knowledge/commit/d59923ab6a5f29ea5c3f2371e485a12151f9460c))


### Bug Fixes

* **commands:** add explicit README check criteria to commit command ([fb7bd7b](https://github.com/blueraai/bluera-knowledge/commit/fb7bd7bb745b0e92199274185ec6ac8267613c9a))
* **hooks:** make precommit scripts properly fail on errors ([d21c39e](https://github.com/blueraai/bluera-knowledge/commit/d21c39e33c51710107414772a8a9e57a9a386fb1))

## [0.9.18](https://github.com/blueraai/bluera-knowledge/compare/v0.9.16...v0.9.18) (2026-01-06)


### Features

* **commands:** add CLAUDE.md awareness to commit command ([7c13ac8](https://github.com/blueraai/bluera-knowledge/commit/7c13ac8279db934009eba41705b035c709881fa3))
* **mcp:** consolidate 10 tools into 3 via execute meta-tool ([d59923a](https://github.com/blueraai/bluera-knowledge/commit/d59923ab6a5f29ea5c3f2371e485a12151f9460c))


### Bug Fixes

* **commands:** add explicit README check criteria to commit command ([fb7bd7b](https://github.com/blueraai/bluera-knowledge/commit/fb7bd7bb745b0e92199274185ec6ac8267613c9a))
* **hooks:** make precommit scripts properly fail on errors ([d21c39e](https://github.com/blueraai/bluera-knowledge/commit/d21c39e33c51710107414772a8a9e57a9a386fb1))

## [0.9.17](https://github.com/blueraai/bluera-knowledge/compare/v0.9.16...v0.9.17) (2026-01-06)


### Features

* **mcp:** consolidate 10 tools into 3 via execute meta-tool ([d59923a](https://github.com/blueraai/bluera-knowledge/commit/d59923ab6a5f29ea5c3f2371e485a12151f9460c))


### Bug Fixes

* **commands:** add explicit README check criteria to commit command ([fb7bd7b](https://github.com/blueraai/bluera-knowledge/commit/fb7bd7bb745b0e92199274185ec6ac8267613c9a))
* **hooks:** make precommit scripts properly fail on errors ([d21c39e](https://github.com/blueraai/bluera-knowledge/commit/d21c39e33c51710107414772a8a9e57a9a386fb1))

## [0.9.16](https://github.com/blueraai/bluera-knowledge/compare/v0.9.14...v0.9.16) (2026-01-06)


### Features

* **ci:** add workflow_dispatch to auto-release for manual triggering ([4835c9c](https://github.com/blueraai/bluera-knowledge/commit/4835c9c698766999154ff217475b3f38718289d6))
* **crawl:** add Claude CLI availability detection for npm package mode ([9afaae5](https://github.com/blueraai/bluera-knowledge/commit/9afaae5b4b4da98ce787d966c9910004401756dd))
* **release:** add automatic changelog generation with commit-and-tag-version ([177c6a3](https://github.com/blueraai/bluera-knowledge/commit/177c6a35f0a965b701940b2f8fc72fe2e4645647))
* rename to @blueraai/bluera-knowledge and add npm publishing ([51a86cb](https://github.com/blueraai/bluera-knowledge/commit/51a86cb574fb9752224e724c1047a5000f4e898b))
* **skills:** add hybrid MCP + Skills enhancement ([9fbee1d](https://github.com/blueraai/bluera-knowledge/commit/9fbee1d90d02663dbda9646e244423c7840330a6))


### Bug Fixes

* **ci:** add model warm-up step to prevent race conditions ([4f5cc6a](https://github.com/blueraai/bluera-knowledge/commit/4f5cc6a6a33f4ab28e8daa2ee6a02e1cc81bf59b))
* **ci:** correct model cache location and test timeouts ([8ae7d9d](https://github.com/blueraai/bluera-knowledge/commit/8ae7d9dcd38ac7ccea3a5bae83ef07449adb693f))
* **ci:** use bun in release workflow and add concurrency controls ([659c4f8](https://github.com/blueraai/bluera-knowledge/commit/659c4f83c7d4f093a5d626c9e460db92e82e3c9c))
* **ci:** use check-regexp in update-marketplace and improve tag extraction ([a009d5f](https://github.com/blueraai/bluera-knowledge/commit/a009d5f90c6f5ddd3244a9f15fa228630dbd509d))
* **ci:** use check-regexp to wait for CI jobs that exist immediately ([34a4be2](https://github.com/blueraai/bluera-knowledge/commit/34a4be2fa4a64221efc84b66b16491bb0624701f))
* **cli:** resolve hanging subprocess by adding destroyServices cleanup ([36acc15](https://github.com/blueraai/bluera-knowledge/commit/36acc1560ed6ea999781e63614de701c7277c8d5))
* **docs:** remove nested code blocks breaking GitHub rendering ([11aef7a](https://github.com/blueraai/bluera-knowledge/commit/11aef7a433623c8831e235714a7c1382b146504d))
* **hooks:** make npm precommit script use smart git hook ([4a9f6b0](https://github.com/blueraai/bluera-knowledge/commit/4a9f6b0bddfd3d1d310b8dba40093c36cc3fa163))
* **package:** correct npm org from [@blueraai](https://github.com/blueraai) to [@bluera](https://github.com/bluera) ([7366ebd](https://github.com/blueraai/bluera-knowledge/commit/7366ebd14a406c36a3675bb8d64d57bf3732b2f1))
* **security:** address vulnerabilities from security audit ([4de8b46](https://github.com/blueraai/bluera-knowledge/commit/4de8b461268484dadccee86da42f96c6917e262d))
* **test:** remove flaky performance assertions from stress tests ([69a480b](https://github.com/blueraai/bluera-knowledge/commit/69a480ba00b6e4b5aace4ea1b732c0246552dc40))

## [0.9.15](https://github.com/blueraai/bluera-knowledge/compare/v0.9.14...v0.9.15) (2026-01-06)


### Features

* **crawl:** add Claude CLI availability detection for npm package mode ([9afaae5](https://github.com/blueraai/bluera-knowledge/commit/9afaae5b4b4da98ce787d966c9910004401756dd))
* **release:** add automatic changelog generation with commit-and-tag-version ([177c6a3](https://github.com/blueraai/bluera-knowledge/commit/177c6a35f0a965b701940b2f8fc72fe2e4645647))
* rename to @bluera/bluera-knowledge and add npm publishing ([51a86cb](https://github.com/blueraai/bluera-knowledge/commit/51a86cb574fb9752224e724c1047a5000f4e898b))
* **skills:** add hybrid MCP + Skills enhancement ([9fbee1d](https://github.com/blueraai/bluera-knowledge/commit/9fbee1d90d02663dbda9646e244423c7840330a6))


### Bug Fixes

* **ci:** add model warm-up step to prevent race conditions ([4f5cc6a](https://github.com/blueraai/bluera-knowledge/commit/4f5cc6a6a33f4ab28e8daa2ee6a02e1cc81bf59b))
* **ci:** correct model cache location and test timeouts ([8ae7d9d](https://github.com/blueraai/bluera-knowledge/commit/8ae7d9dcd38ac7ccea3a5bae83ef07449adb693f))
* **cli:** resolve hanging subprocess by adding destroyServices cleanup ([36acc15](https://github.com/blueraai/bluera-knowledge/commit/36acc1560ed6ea999781e63614de701c7277c8d5))
* **docs:** remove nested code blocks breaking GitHub rendering ([11aef7a](https://github.com/blueraai/bluera-knowledge/commit/11aef7a433623c8831e235714a7c1382b146504d))
* **hooks:** make npm precommit script use smart git hook ([4a9f6b0](https://github.com/blueraai/bluera-knowledge/commit/4a9f6b0bddfd3d1d310b8dba40093c36cc3fa163))
* **security:** address vulnerabilities from security audit ([4de8b46](https://github.com/blueraai/bluera-knowledge/commit/4de8b461268484dadccee86da42f96c6917e262d))
* **test:** remove flaky performance assertions from stress tests ([69a480b](https://github.com/blueraai/bluera-knowledge/commit/69a480ba00b6e4b5aace4ea1b732c0246552dc40))

## [0.9.11] - 2026-01-04

### Fixed
- CI automation: Use `workflow_run` trigger for marketplace updates (GitHub security prevents `GITHUB_TOKEN` workflows from triggering other workflows)

## [0.9.10] - 2026-01-04

### Added
- Automated marketplace updates via GitHub Actions workflow
- Update Marketplace workflow waits for CI to pass before updating `blueraai/bluera-marketplace`

### Changed
- Release workflow now automatically triggers marketplace update (no manual steps required)

## [0.9.9] - 2026-01-04

### Fixed
- MCP server auto-discovery: moved `.mcp.json` to plugin root (was incorrectly in `.claude-plugin/`)

## [0.9.8] - 2026-01-04

### Fixed
- Plugin installation failures caused by root `.mcp.json` conflicting with plugin structure

## [0.9.7] - 2026-01-03

### Added
- Claude Code perspective documentation explaining how to use bluera-knowledge effectively

### Changed
- Enhanced README with blockquote formatting, tables, and improved section organization
- Added table of contents for better navigation

## [0.9.6] - 2026-01-03

### Changed
- Clarified MCP configuration for local development vs distribution
- Documentation improvements for job status and search capabilities

## [0.9.5] - 2026-01-03

### Fixed
- SessionStart hook now installs node_modules on first session

### Added
- Marketplace update reminder in release workflow
- Version script improvements

## [0.9.4] - 2026-01-02

### Added
- MCP symlink setup documentation for local development
- `.mcp.json` in `.claude-plugin/` for marketplace installs
- `release:current` script for tagging existing versions

### Changed
- Improved CLAUDE.md with npm scripts reference

## [0.9.3] - 2026-01-02

### Added
- Multi-language support for dependency detection (Python, Go, Rust, Java)
- crates.io and Go module registry support for URL resolution

### Changed
- Expanded crawl command examples with natural language options
- Streamlined installation section in README

## [0.9.0-0.9.2] - 2026-01-02

### Added
- Automatic GitHub release workflow on tag push
- Release scripts (`npm run release:patch/minor/major`)

### Changed
- Plugin restructured for correct Claude Code plugin layout
- Repository moved to blueraai organization

### Fixed
- IndexService tests skipped in CI environment (coverage threshold adjusted)

## [0.7.0-0.8.0] - 2026-01-01

### Added
- LICENSE, NOTICE, and acknowledgments
- Plugin UI documentation for browsing/installing

### Changed
- Marketplace moved to dedicated repository
- Installation section moved to top of README

## [0.6.0] - 2026-01-01

### Added
- Headless browser support via crawl4ai for JavaScript-rendered sites (Next.js, React, Vue, etc.)
- `--headless` flag for crawl command to enable Playwright browser automation
- Python bridge method `fetchHeadless()` using crawl4ai's AsyncWebCrawler
- Automatic fallback to axios if headless fetch fails
- Mermaid sequence diagrams in README.md showing crawler architecture for both modes
- Comprehensive documentation for headless crawling in commands/crawl.md

### Changed
- `fetchHtml()` now accepts optional `useHeadless` parameter for browser automation
- `CrawlOptions` interface includes `useHeadless` field
- Updated Dependencies section in README with playwright installation instructions
- Extended `crawl` command with `--headless` option and updated TypeScript types

### Improved
- Crawler now handles JavaScript-rendered sites that require client-side rendering
- Preserves intelligent crawling with natural language instructions in both standard and headless modes

## [0.5.3] - 2026-01-01

### Changed
- Move Store to its own line for better vertical scannability

## [0.5.2] - 2026-01-01

### Changed
- Add text labels before all badges in search results (File:, Purpose:, Top Terms:, Imports:)

## [0.5.1] - 2026-01-01

### Changed
- Replace emoji badges with text labels for search methods: [Vector+FTS], [Vector], [Keyword]
- Add "Store:" prefix to search results for better clarity

## [0.5.0] - 2026-01-01

### Added
- Ranking attribution badges showing search method for each result (🎯 both, 🔍 vector, 📝 FTS)
- Search mode display in results header (vector/fts/hybrid)
- Performance metrics in search results footer (time in milliseconds)
- Ranking metadata preserved in search results (vectorRank, ftsRank, RRF scores, boost factors)

### Changed
- Renamed "Keywords" to "Top Terms (in this chunk)" for clarity about scope and methodology
- Updated "Imports" to "Imports (in this chunk)" to clarify chunk-level analysis
- Search results now show which ranking method(s) contributed to each result

### Improved
- Search result transparency - users can now see how each result was found
- Label clarity - all labels now explicitly state they analyze chunk content, not whole files

## [0.4.22] - 2026-01-01

### Changed
- Renamed "Related" to "Keywords" for clarity - these are the most frequent meaningful terms extracted from the code
- Restored default search limit from 5 to 10 results (user preference)
- Updated README with new search output format and current version badge

### Fixed
- Search result labels now accurately describe what they show (Keywords are top 5 frequent words, not related concepts)

## [0.4.21] - 2026-01-01

### Added
- Display related concepts and key imports in search results (from contextual detail)
- Actionable "Next Steps" footer with examples using actual result IDs and paths
- Richer context to help users decide which results to explore

### Changed
- Reduced default limit from 10 to 5 results (quality over quantity)
- Enhanced result format shows Related concepts (🔗) and Imports (📦)

## [0.4.20] - 2026-01-01

### Fixed
- Search results now display directly in conversation (not in verbose mode)
- Abandoned table formatting approach - Bash output is collapsed by default

### Changed
- Switched to clean list format with emoji icons for better readability
- Results display immediately without requiring ctrl+o to expand

## [0.4.19] - 2026-01-01

### Fixed
- Search command now uses Python formatter via Bash for deterministic table output
- Fixed broken table alignment in terminal (columns now properly aligned with fixed widths)

### Changed
- Updated search.md to pipe MCP results through format-search-results.py
- Command instructs Claude to execute Python formatter for proper table rendering

## [0.4.18] - 2026-01-01

### Fixed
- Search command now displays results correctly in conversation transcript
- Removed PostToolUse hook approach (output only visible in verbose mode)
- Claude now formats results directly with simpler markdown table syntax

### Changed
- Simplified search result formatting - removed fixed-width column requirements
- Updated command to use standard markdown tables instead of hook-based formatting

### Removed
- PostToolUse hook for search formatting (`format-search-results.py` retained for reference)

## [0.4.17] - 2026-01-01

### Fixed
- Fixed duplicate search output by instructing Claude not to generate tables
- PostToolUse hook now solely responsible for displaying formatted results

## [0.4.16] - 2026-01-01

### Changed
- Replaced prompt-based table formatting with deterministic PostToolUse hook
- Search results now formatted by Python script with precise column widths
- Simplified search.md command - formatting handled by hook

### Added
- `hooks/format-search-results.py` - deterministic table formatter for search output

## [0.4.15] - 2026-01-01

### Fixed
- Fixed search command table alignment by enforcing fixed-width columns with proper padding
- Separator row now uses exact cell widths (7/14/47/50 chars) for proper vertical alignment
- All column borders now align perfectly in terminal output

## [0.4.14] - 2026-01-01

### Fixed
- Enforced strict column width limits in search command output to prevent table formatting issues
- Added explicit truncation rules (Store: 12 chars, File: 45 chars, Purpose: 48 chars)
- Improved command documentation with clear examples of text truncation

## [0.4.13] - 2026-01-01

### Fixed
- Fixed table separator alignment in search output
- Better visual formatting for search results

## [0.4.11-0.4.12] - 2026-01-01

### Changed
- Changed search output to table format
- Added store names to search results for clarity

## [0.4.10] - 2026-01-01

### Added
- Added store names to search results

### Removed
- Removed flaky stress tests

## [0.4.4] - 2025-12-31

### Changed
- Table formatting refinements (clean IDs, ~ for home paths)
- Improved readability of stores command output

## [0.4.3] - 2025-12-31

### Changed
- Store list outputs in beautiful table format
- Enhanced command output presentation

## [0.4.2] - 2025-12-30

### Changed
- Commands converted to use MCP tools instead of bash execution
- Improved architecture for command handling
- Better integration with Claude Code's tool system

## [0.4.1] - 2025-12-29

### Added
- Auto-install Python dependencies via SessionStart hook
- Seamless setup experience for web crawling features
- PEP 668 compliance for modern Python environments

## [0.3.0] - 2025-12-28

### Added
- Web crawling with crawl4ai integration
- Create and index web stores from documentation sites
- Markdown conversion of web content

## [0.2.0] - 2025-12-27

### Added
- Smart usage-based dependency suggestions
- Automatic repository URL resolution via package registries

### Changed
- Improved analysis performance

### Fixed
- Fixed command prefix inconsistencies

## [0.1.x] - 2025-12-26

### Added
- Initial release
- Repository cloning and indexing
- Local folder indexing
- Semantic vector search with embeddings
- MCP server integration
