Steps to set up a new queue

- Define types in `src/workers/types.ts`
- Define global types in `global.d.ts`
  - queue, queue events, worker
- Cleanup/setup queue and events in `src/server/queue/index.ts`
- Add to `queue` export

- Build the worker

# 2023-05-21

## How does the bills asset get materialized?

- Run policy
  - Check if json files exist for each page
  - Write the bills asset meta file with current time and pages to fetch
- Maybe run create function
  - Read meta file to see what it needs to do
  - Get the data
  - Write to disk

## Some decisions we had made about how Assets work last time

- Policy is responsible for deciding what needs to be done and writes it to meta file
- Create function reads meta file to decide what it should do
- Write function is unnecessary, just write inside create
- We added a `readMetadata` function so we can expose that information to the UI

## Rename assets

- bills -> billList
- actions -> bill

## Implement Bill Asset

- each bill has at least 2 pages
  - bill detail page
    - sponsor info
  - bill actions pages

### Ways we can store the data

1. directly mirror the congress API endpoints we hit. 1 json file per response
2. merge all the API responses into a single json file for the bill
3. store in a db

#### What are the pros and cons of 2 vs 3?

- pro for 2: simpler to write files than use a db
- pro for 3: maybe checking policy can be more performant?
- con for 2: 10s of thousands of file in a folder is unweildy. interfaces for handling db entries are more usable
- pro for 1: more granular updating