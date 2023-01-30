report asset

refresh policy = false
completeness
current set of things
description of the desired total set of things

refresh policy () => boolean
true = fresh; don't computer just return what's cached
false = stale; recompute, cache, return
can be defined in terms of refresh policies of assets this depends on too

dependency assets:
term
bill

termQueryEngine = get term asset (congress chamber)
get bills asset (congress chamber)
reduce terms and bills into report
return report csv

---

term asset

is an api get get a member at a term

refresh policy is to make a request to congress api /member
with fromDateTime = last fetch time. if response is not empty
refetch and return, otherwise just return current stored version

no dependency assets

fetch members from congress api
paginate through
filter the ones that overlap chambresses we care about
for each member: get member asset (bioguide id)
not returning list of member terms for this chambress
return the db or some object that lets you access and query those members

---

bill importance asset

depends on assets: ranking phrases, important list

--

important list asset

completeness polciy: make sure a file exists for each chambress
freshness: always true

opens the file and returns an array of numbers

---

bill steps asset

--

bill issues asset

--

bill committees asset

--

interface of the execution graph itself
graph.materialize(asset)

graph.materialize(report)
Report {
}

assets:Map<AssetDefinition,Asset>()

runFreshnessPolicy(){}
updateLastMaterializedTime(){}
runCompletenessPolicy(){}
generateAndCacheAsset(){}
getAssets(){}

materialize(asset) {
// check if its fresh and complete
const ctx = asset.createContext()
const isFresh = runFreshnessPolicy(asset.freshnessPolicy, ctx)
const isComplete = runCompletenessPolicy(asset.completenessPolicy)

if(!isFresh || !isComplete) {
generateAndCache(asset.execute, getAssets(asset.dependencies), ctx)
updateLastMaterializedTime(asset)
}

// instrument asset lifecycle
return asset.materialized
}

generateAndCache(executorFn, ...dependencyAssets) {
const newData = executorFn(dependencyAssets)
updateCache(asset.storageFn, newData)
}

myExecutorFn(myDep1, myDep2) {
myDep1.getNumber()
myDep2.getString()
return a + b
}

# Some pseudocode, discussion below

    type AssetKey = 'Term' // tables <-> Assets link

    type Engine = () => void // query builder/engine

    type Policy = () => boolean

    type Refresh = () => Promise<void> // could dispatch metdata

    // our concept of a dagster software defined asset
    interface Asset {
        // relationship to underlying record
        key: AssetKey,
        // upstream dependency assets
        dependencies: Asset[] | null,
        // query builder
        engine: Engine,
        // how to ensure freshness
        freshnessPolicy: Policy,
        // how to ensure completeness
        completenessPolicy: Policy,
        // how to refresh an asset given policy failure
        refresh: Refresh
    }


    // function we use to refresh an asset and its dependenices given policy outcomes
    async function materialize(asset: Asset): Promise<void> {
        const dependencies = asset.dependencies
        if (dependencies) {
            dependencies.forEach((d) => {
                const dfresh = d.freshnessPolicy()
                const dcomplete = d.completenessPolicy()
                if (!dfresh || !dcomplete) {
                    d.refresh()
                }
            })
        }
        const fresh = asset.freshnessPolicy()
        const complete = asset.completenessPolicy()
        if (!fresh || !complete) {
            asset.refresh()
        }
    }

    // function we'd use in a job to get engine w/ fresh + complete guarantees
    async function getAssetEngineByKey(key: AssetKey): Promise<Engine> {
        const asset = assets.get(key)
        if (!asset) {
            throw new Error()
        } else {
            await materialize(asset)
            return asset.engine
        }
    }

    // the term engine
    function termEngine() {
        // some methods to assist in term record retrieval
        // blah blah
        return
    }

    // term policies
    function termFreshnessPolicy() {
        // commented pseudo implementation b/c type errors are annoying
        // const lastMaterializedDate = db.getTermLastMaterializedDate()
        // const lastUpdatedDate = congressAPI.getLastUpdatedDate()
        // lastUpdatedDate > lastMaterializedDate ? false : true
        return true
    }
    function termCompletenessPolicy() {
        // commented pseudo implementation b/c type errors are annoying
        // const extantCount = db.getTermCount()
        // const freshCount = congressAPI.getCompleteTermCount()
        // return extantCount != freshCount ? false : true
        return true
    }

    async function refreshTerm(): Promise<void> {
        // commented pseudo implementation b/c type errors are annoying
        // refreshedTerms = await congressAPI.getTerms()
        // termRecords = await utils.parseTerms(refreshedTerms)
        // await db.upsert(refreshedTerms)
    }


    // now we actually create our assets
    const Term: Asset = {
        key: 'Term',
        dependencies: null,
        engine: termEngine,
        freshnessPolicy: termFreshnessPolicy,
        completenessPolicy: termCompletenessPolicy,
        refresh: refreshTerm,
    }

    // make them available via a Map of Key to Asset
    const assets = new Map<AssetKey, Asset>()
    assets.set('Term', Term)

writing code in the report worker now, where we'd want to work with the term engine

    // .workers/standardReportWorker.ts
    const termQueryBuilder = getAssetEngineByKey('Term')

# What's happening here?

1. Given the arg (here, `'Term'`), we get the asset from `assets`
2. With the asset in hand, we pass it to `materialize()`
3. If the asset and its dependencies are deemed fresh and complete by `materialize()`, nothing will happen and we will happily return the engine.
4. If the asset or any dependent assets are deemed either stale or incomplete by materialize, we will refresh the asset via `.refresh()`
5. Materialize will first take the dependencies for the asset, run each dependent assets' freshness and completeness policies, and conditionally `.refresh()` based on the outcome of those policies
6. `.refresh()` will update the underlying record and furnish any metadata required to satisfy the freshness and completeness policies of a given asset
7. The running of this terminal `.refresh()` leads us to resolve the initial `materialiaze()` called in `getAssetEngineByKey`,
   and successfully return engine, with guarantees that the asset and all of its dependents have been materialized, and deemed fresh and complete.
8. we can then proceed to using the engine in our job, like so

   const termsForReport = termQueryBuilder(chamber, congress)

# Stuff I'm struggling with

1. How to pass args to the engine? provide a generic to the Asset that types the Engine?
2. Is a map of asset keys to assets dog? unecessary?
3. Each asset will have its own, separately implemented freshness policy, completeness policy, refresh method, engine, and dependency list. That sounds necessary to me, I think. But I just want to type it out somewhere. I'm pretty sure these are the lines along which given assets are actually different, i.e: how a given asset is refreshed, how to determine a given asset's freshness, completeness, a given asset's dependencies and engine, are all unique to that asset. The common behavior shared amongst them is how those unique properties are bunlded up and used, which we call here 'materializing': chug through the dependency tree and run all the policies, conditionally refresh, and return an engine upon completion.
4. Maybe engine is generic and not asset specific?
