import { fetchWithRetry } from './congress-api-fetch'
import dotenv from 'dotenv'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import { z } from 'zod'

// env
dotenv.config()
const NODE_ENV = z.string().parse(process.env.NODE_ENV)

// import fs functions based on $NODE_ENV
// 'development' => sftp methods
// 'ec2-dev' => local methods
// anything else => unsupported, process.exit(1)
if (NODE_ENV === 'development') {
  // sftp methods
  // unwritten/unsupported right now
} else if (NODE_ENV === 'ec2-dev') {
  // local methods
} else {
  // unsupported $NODE_ENV
  console.log(`Unsupported $NODE_ENV: ${NODE_ENV}`)
  process.exit(1)
}

// validators for congress.gov api responses
const billTypeLowercaseValidator = z.enum(['hr', 's'])
const shortChamberNameValidator = z.enum(['House', 'Senate'])
const requestValidator = z.object({
  billType: billTypeLowercaseValidator.optional(),
  congress: z.string().optional(),
  contentType: z.string(),
  format: z.string(),
})

const paginationValidator = z.object({
  count: z.number(),
  next: z.string().url().optional(),
  prev: z.string().url().optional(),
})
const billDetailValidator = z.object({
  actions: z.object({
    count: z.number(),
    url: z.string(),
  }),
  amendments: z
    .object({
      count: z.number(),
      url: z.string(),
    })
    .optional(),
  cboCostEstimates: z
    .array(
      z.object({
        pubDate: z.string(),
        title: z.string(),
        url: z.string(),
      }),
    )
    .optional(),
  committeeReports: z
    .array(
      z.object({
        citation: z.string(),
        url: z.string(),
      }),
    )
    .optional(),
  committees: z
    .object({
      count: z.number(),
      url: z.string(),
    })
    .optional(),
  congress: z.number(),
  constitutionalAuthorityStatementText: z.string().optional(),
  cosponsors: z
    .object({
      count: z.number(),
      countIncludingWithdrawnCosponsors: z.number(),
      url: z.string(),
    })
    .optional(),
  introducedDate: z.string(),
  latestAction: z.object({
    actionDate: z.string(),
    text: z.string(),
  }),
  laws: z
    .array(
      z.object({
        number: z.string(),
        type: z.string(),
      }),
    )
    .optional(),
  number: z.string(),
  originChamber: shortChamberNameValidator,
  policyArea: z
    .object({
      name: z.string(),
    })
    .optional(),
  relatedBills: z
    .object({
      count: z.number(),
      url: z.string(),
    })
    .optional(),
  sponsors: z
    .array(
      z.object({
        bioguideId: z.string(),
        fullName: z.string(),
        firstName: z.string(),
        lastName: z.string(),
        middleName: z.string().optional(),
        isByRequest: z.string(),
        url: z.string(),
        party: z.string(),
        state: z.string(),
        district: z.number().optional(),
      }),
    )
    .length(1)
    .optional(),
  subjects: z
    .object({
      count: z.number(),
      url: z.string(),
    })
    .optional(),
  summaries: z
    .object({
      count: z.number(),
      url: z.string(),
    })
    .optional(),
  textVersions: z
    .object({
      count: z.number(),
      url: z.string(),
    })
    .optional(),
  title: z.string(),
  titles: z.object({
    count: z.number(),
    url: z.string(),
  }),
  type: z.string(),
  updateDate: z.string(),
  updateDateIncludingText: z.string(),
})
const billDetailResponseValidator = z.object({
  bill: billDetailValidator,
  error: z.string().optional(),
  pagination: paginationValidator.optional(),
  request: requestValidator,
})

const billActionsValidator = z.array(
  z.object({
    actionCode: z.string().optional(),
    actionDate: z.string(),
    actionTime: z.string().optional(),
    recordedVotes: z
      .array(
        z.object({
          chamber: shortChamberNameValidator,
          congress: z.number(),
          date: z.string(),
          rollNumber: z.number(),
          sessionNumber: z.number(),
          url: z.string().url(),
        }),
      )
      .optional(),
    committees: z
      .array(
        z.object({
          name: z.string(),
          systemCode: z.string(),
          url: z.string(),
        }),
      )
      .optional(),
    sourceSystem: z.object({
      code: z.number().optional(),
      name: z.string(),
    }),
    text: z.string(),
    type: z.string(),
  }),
)
const billActionsResponseValidator = z.object({
  actions: billActionsValidator,
  error: z.string().optional(),
  pagination: paginationValidator,
  request: requestValidator,
})

const committeeActivitiesValidator = z.object({
  date: z.string(), // TODO: support dateString
  name: z.string(),
})

const billCommitteesValidator = z.array(
  z.object({
    // it seems like activities is optional in some cases (e.g., HR-8255)
    // I have only observed it has happening with cross-chamber subcommittee attention,
    // e.g., HR-8255 received attention (i.e., has a defined activities propety) from the
    // Senate Appropriations Subcommittee on Energy and Water Development, but no activities
    // from the committee in the whole. In practice, this leaves the activities property at the
    // first level (i.e., at the ocmmittee object level) undefined, but defined in the subcommittee
    // TODO: It's maybe possible to conceive of this as a refinement, where the activities property is optional
    // iff the committee object chamber value is of the opposite of the bill's chamber of introduction
    activities: z.array(committeeActivitiesValidator).optional(),
    chamber: shortChamberNameValidator,
    name: z.string(),
    subcommittees: z
      .array(
        z.object({
          activities: z.array(committeeActivitiesValidator),
          name: z.string(),
          systemCode: z.string(),
          url: z.string().url(),
        }),
      )
      .optional(),
    systemCode: z.string(),
    type: z.string(), // TODO: enummable, i.e. Standing, Select. Just not sure of extent of vals
    url: z.string().url(),
  }),
)

const billCommitteesResponseValidator = z.object({
  committees: billCommitteesValidator,
  error: z.string().optional(),
  pagination: paginationValidator,
  request: requestValidator,
})

// types
type Validator =
  | typeof billActionsResponseValidator
  | typeof billCommitteesResponseValidator
  | typeof billDetailResponseValidator

type ValidatedData = z.infer<Validator>

const endpointValidator = z.union([
  z.literal('actions'),
  z.literal('committees'),
  z.literal('details'),
])
type Endpoint = z.infer<typeof endpointValidator>

// utils
function getEndpointFromRoute(route: string): Endpoint {
  // 3 types of route -> endpoint mappings
  // .../{billNumber} -> details
  // .../{billNumber}/actions -> actions
  // .../{billNumber}/committees -> committees
  const splitRoute = route.split('/')
  let endpoint: string
  if (splitRoute[splitRoute.length - 1].match(/\d+/)) {
    endpoint = 'details'
  } else {
    endpoint = splitRoute[splitRoute.length - 1]
  }
  const validatedEndpoint = endpointValidator.safeParse(endpoint)
  if (!validatedEndpoint.success) {
    console.log(`Invalid route -> endpoint conversion`)
    console.log(`route: ${route}`)
    console.log(`endpoint: ${endpoint}`)
    throw new Error()
  }
  return validatedEndpoint.data
}

function getValidatorForEndpoint(endpoint: Endpoint): Validator {
  // Given a route, get the appropriate endpoint validator
  switch (endpoint) {
    case 'actions':
      return billActionsResponseValidator
    case 'committees':
      return billCommitteesResponseValidator
    case 'details':
      return billDetailResponseValidator
    default:
      throw new Error(`No validator for route: ${endpoint}`)
  }
}

function getParamsFromRoute(route: string): [string, string, string] {
  // Given a route, get the appropriate params for the fetch request
  const endpoint = getEndpointFromRoute(route)
  const splitRoute = route.split('/')
  switch (endpoint) {
    case 'actions':
      // .../{congress}/{billType}/{billNumber}/actions
      return [
        splitRoute[splitRoute.length - 4],
        splitRoute[splitRoute.length - 3],
        splitRoute[splitRoute.length - 2],
      ]
    case 'committees':
      // .../{congress}/{billType}/{billNumber}/committees
      return [
        splitRoute[splitRoute.length - 4],
        splitRoute[splitRoute.length - 3],
        splitRoute[splitRoute.length - 2],
      ]
    case 'details':
      // .../{congress}/{billType}/{billNumber}
      return [
        splitRoute[splitRoute.length - 3],
        splitRoute[splitRoute.length - 2],
        splitRoute[splitRoute.length - 1],
      ]
    default:
      throw new Error(
        `[getParamsFromRoute] ERROR: -- endpoint: ${endpoint} route: ${route}`,
      )
  }
}

function makeFileNameForEndpoint(
  path: string,
  endpoint: Endpoint,
  page?: number,
): string {
  const pageString = page ? `-${page}` : ''
  switch (endpoint) {
    case 'actions':
      return `${path}/${endpoint}${pageString}.json`
    case 'committees':
      return `${path}/${endpoint}${pageString}.json`
    case 'details':
      return `${path}/${endpoint}${pageString}.json`
    default:
      throw new Error(
        `Failed to make fileName for path ${page} endpoint ${endpoint} page ${page}`,
      )
  }
}

// read instructions produced by audit-cache
const routes = readFileSync('./cache/instructions/6-18-2024--10-36-50-AM.txt')
  .toString()
  .split('\n')

type RouteKey = {
  endpoint: Endpoint
  page: number
  data: ValidatedData | ReturnType<typeof fetchWithRetry>
}
async function main() {
  console.log('Starting cache repair')
  for (const route of routes) {
    let offset = 0
    let page = 1
    let limit = 250
    let hasNextPage = true
    let routeData: Array<RouteKey> = []

    while (hasNextPage) {
      const endpoint = getEndpointFromRoute(route)
      const validator = getValidatorForEndpoint(endpoint)
      const response = await fetchWithRetry(route, offset, limit)

      // validate the data
      const validatedResponse = validator.safeParse(response)

      // successful validation
      if (validatedResponse.success === true) {
        // successful validation
        console.log(`Successfully validated data for page ${page} of ${route}`)
        routeData.push({ endpoint, page, data: validatedResponse.data })
      } else {
        console.log(`Failed to validate data for page ${page} of ${route}`)
        routeData.push({ endpoint, page, data: response })
      }

      // Check if we need to paginate through response
      // if there's a next page, update offset and page
      if (response.pagination && response.pagination.next) {
        offset += limit
        page++
      } else {
        // if no next page, set condition to false to break
        hasNextPage = false
      }
    }

    // accumualated route data, move to writing phase
    console.log('Finished fetching route data')

    // just write to local for now
    // grab params from route for dir structure
    console.log('starting write phase')

    const [congress, billType, billNumber] = getParamsFromRoute(route)
    const baseFilePath = `./cache/temp/${congress}/${billType}/${billNumber}`
    // mkdir if necessary
    if (!existsSync(baseFilePath)) {
      mkdirSync(baseFilePath, { recursive: true })
      console.log(`Creating ${baseFilePath}`)
    }

    // if nothing there, skip
    if (routeData.length === 0) {
      console.log(`No data for ${route}`)
      continue
    }

    // if only one page, don't pass page to makeFileName fcn
    if (routeData.length === 1) {
      const { endpoint, page, data } = routeData[0]
      const fileName = makeFileNameForEndpoint(baseFilePath, endpoint)
      console.log(`Writing data to ${fileName}`)
      continue
    }

    // if multiple pages, pass page to makeFileName fcn
    for (const routeKey of routeData) {
      const { endpoint, page, data } = routeKey
      const fileName = makeFileNameForEndpoint(baseFilePath, endpoint, page)
      console.log(`Writing data to ${fileName}`)
    }

    // break on indexOf 5 for testing
    break
    // if (routes.indexOf(routes[5]) === 5) {
    //   break
    // }
  }
}
main()
