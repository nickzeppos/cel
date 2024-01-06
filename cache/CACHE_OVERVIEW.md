# Cache Overview

## TODO

### questions to answer

- should `generate-cache-health-report.ts` auto generate a config file if none exists? currently it does not, just prompts to run `create-cache-config.ts`

### actions to take

- `generate-cache-health-report.ts` needs to pivot on current or full arg
- `generate-cache-health-report.ts` needs to output a `.txt` file for consumption by `consume-health-report-instructions.ts`
- Implement `consume-health-report-instructions.ts`
- Specify shape of `meta.json`
- Bundle everything up in a main() script
- Event logging

## intro

This document provides an overview of the `cache` folder. Two primary responsibilities: (1) housing the data itself (`cache/data`), maintaining the integrity of said cache.

General flow is something like this:

```
(1) If no cache config, create config.
(2) Generate health report and instructions based on config.
(3) Consume health report instructions, update meta.
```

## fs

The `/cache` folder contains TS files and a `data` subfolder. The data subfolder contains a config file (`cache-config.json`), metadata (`meta.json`), and structured data related to bills.

```
 cache
 ├── CACHE_OVERVIEW.md
 ├── cache-health-reports
 ├── create-cache-config.ts
 ├── data
 │   ├── bill
 │   │   └── {congressNumber}
 │   │       └── {billType}
 │   │           ├── {billNumber}.json
 │   │           └── {billNumber}
 │   │               ├── committees.json
 │   │               └── actions.json
 │   ├── meta.json
 │   └── cache-config.json
 ├── generate-cache-health-report.ts
 ├── tsconfig.json
 └── utils.ts
```

## ts files

### create-cache-config.ts

- **Purpose:** Generates a config file for the cache.
- **Functionality:** Creates `cache-config.json` in the `data` folder. This config file outlines the ideal state of the cache for maintaining its health.

### generate-cache-health-report.ts

- **Purpose:** Generates a health report for the cache.
- **Functionality:** Utilizes `cache-config.json` to assess and report the current state of the cache.

  Can generate reports based on the ideal cache state or the current state. Outputs a `.txt` file for consumption by a `consume-health-report-instructions.ts`

  Will not generate report without a `cache-config.json` file; will prompt to run.

### consume-health-report-instructions.ts

- **Purpose:** Make cache healthy.
- **Functionality** Consumes health report instructions and updates the cache accordingly.

### utils.ts

- **Purpose:** Utility functions for the cache.
- **Functionality:** Contains functions for path manipulation, throttling, logging, etc.

### types.ts

- **Purpose:** Types for the cache.
