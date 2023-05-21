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

## Implement Actions Asset