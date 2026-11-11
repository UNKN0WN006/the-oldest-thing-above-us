# Change log

## 2026-11-11 — Code review and reliability update

- Corrected an invalid backend development dependency (`httpx2`) that prevented a fresh install.
- Distinguished **live**, **mixed**, and **archived** orbital datasets in the API, generated type definitions, interface, and methodology page. An initial successful refresh no longer labels the whole dataset live.
- Preserved per-satellite CelesTrak provenance, timestamps, source links, and scientific limitations.
- Validated discovery deep-link parameters and UTC date inputs before launching calculations; invalid dates now produce an actionable error instead of a runtime exception.
- Made the development command clean up the API process when the frontend exits.
- Added backend regression tests for aggregate data modes and upstream orbital element validation, plus frontend unit tests for date/time validation.
- Clarified the architecture notes, README, and discovery notices: an archived element set does not automatically mean the selected window is the snapshot's capture date.
- Invalidated cached discovery results when the aggregate data mode changes, and made background refresh delays interruptible on shutdown.

This update does not claim that historical narratives have been independently fact-checked, that optical visibility is guaranteed, or that tests have passed on machines where their dependencies are unavailable.
