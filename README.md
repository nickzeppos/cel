# Assets
## billsCount
`billsCount.asset.ts`

*What is it?*
  - The number of bills in a given `congress` and `chamber`.

*What is (are) its dependency(ies)?*
  - No dependencies.

*What is its policy?*
- Does the file exist?

*What is its unique metadata?*
- Does the file exist?

*How is it created?*
- 1 request to congress.gov API

*Associated endpoint(s)*
- `/bill/{congress}/{billType}` 



## bills
`bills.asset.ts`

*What is it?*  
- All of the bill data in a given congress. Includes bill details, actions, and committee information. 
  
*What is (are) its dependency(ies)?*  
- `billsCount`  

*What is its policy?*  
- For each `billNumber` specified by `billsCount`:
  1. Does the file exist?  
  2. Is the file valid JSON?
  3. Does the file have the expected keys `bill`, `actions`, and `committee`?
  4. Does the `actions` property have the proper count of actions, as specified by the `bill` property?

*What is its unique metadata?* 
- An array containing each bill number that fails the policy.

*How is it created?* 
- `>= 4` requests to congress.gov API for each bill that fails policy

*Associated endpoint(s)*
- `/bill/{congress}/{billType}/{billNumber}` 
- `/bill/{congress}/{billType}/{billNumber}/actions` 
- `/bill/{congress}/{billType}/{billNumber}/committees` 

## billsList
**Note: 1/2024: Deprecated since congress.gov API exposes bill endpoints for reserved bills. No longer necessary to construct a bill list before getting bills, just have to know count.** 

`billsList.asset.ts`  

*What is it?*
  - A list of all bill numbers in a given `congress` and `chamber`. Previously used to construct the range of bill numbers over which bills were fetched.



## Hooking up UI and asset queue events
Working through bills asset, want to hook up the asset tile on the playground page to what's actually going on. Seems like I have to proceed as follows:

- modify initial state query to reflect the change i made to metadata (i.e., is missing bill number array)
- emit events from asset create method. I can characterize these on a bill by bill basis, or I can conceive of a representation of progress that might be more meaningful to the UI
- set up a subscription in the asset playground router (looks like there is one already in there for bills list, called bills-asset-progress, that i can use)
- set up state and subscription in the component
## Steps to set up a new queue

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