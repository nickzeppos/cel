import { Chamber } from '@prisma/client'
import { z } from 'zod'

export const fullChamberNameValidator = z.enum([
  'House of Representatives',
  'Senate',
])

export const shortChamberNameValidator = z.enum(['House', 'Senate'])
export const billTypeValidator = z.enum(['hr', 's'])
export const billJobDataValidator = z.object({
  congress: z.number().min(93),
  billType: billTypeValidator,
  billNum: z.number(),
})
export const termJobDataValidator = z.object({
  bioguide: z.string(),
})
const requestResponseValidator = z.object({
  congress: z.string().optional(),
  contentType: z.string(),
  format: z.string(),
})

const paginationResponseValidator = z.object({
  count: z.number(),
  next: z.string().url().optional(),
  prev: z.string().url().optional(),
})

const congressResponseValidator = z.object({
  congresses: z.array(
    z.object({
      endYear: z.string(),
      startYear: z.string(),
      name: z.string(), // ###th | ###rd Congress
      sessions: z.array(
        z.object({
          chamber: fullChamberNameValidator,
          endDate: z.string().nullable(),
          number: z.number().int(),
          startDate: z.string(),
        }),
      ),
    }),
  ),
  pagination: paginationResponseValidator,
  request: requestResponseValidator,
})

export const billResponseValidator = z.object({
  bill: z.object({
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
      .length(1),
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
  }),
  error: z.string().optional(),
  pagination: paginationResponseValidator.optional(),
  request: requestResponseValidator,
})

export const billActionsResponseValidator = z.object({
  actions: z.array(
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
  ),
  error: z.string().optional(),
  pagination: paginationResponseValidator.optional(),
  request: requestResponseValidator,
})

export const committeeActivitiesValidator = z.object({
  date: z.string(), // TODO: support dateString
  name: z.string(),
})

export const billCommitteesResponseValidator = z.object({
  committees: z.array(
    z.object({
      activities: z.array(committeeActivitiesValidator),
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
  ),
  error: z.string().optional(),
  pagination: paginationResponseValidator.optional(),
  request: requestResponseValidator,
})

export const partyHistoryValidator = z.object({
  endYear: z.union([z.number(), z.string().nullable()]), // API suxxx
  partyCode: z.string(),
  partyName: z.string(),
  startYear: z.number(),
})

export const termResponseValidator = z.object({
  chamber: fullChamberNameValidator,
  congress: z.number(),
  memberType: z.string(),
  stateCode: z.string(),
  stateName: z.string(),
  district: z.number().optional(),
  termBeginYear: z.number(),
  termEndYear: z.number().nullable(),
})

export const memberResponseValidator = z.object({
  member: z.object({
    addressInformation: z
      .object({
        city: z.string(),
        district: z.string(),
        officeAddress: z.string(),
        officeTelephone: z.object({
          phoneNumber: z.string(),
        }),
        zipCode: z.number(),
      })
      .optional(),
    birthYear: z.string(),
    cosponsoredLegislation: z.object({
      count: z.number(),
      url: z.string(),
    }),
    currentMember: z.boolean(),
    deathYear: z.string().nullable(),
    depiction: z.object({
      attribution: z.string(),
      imageUrl: z.string(),
    }),
    directOrderName: z.string(),
    district: z.number().nullable(),
    firstName: z.string(),
    honorificName: z.string().nullable(),
    identifiers: z.object({
      bioguideId: z.string(),
    }),
    invertedOrderName: z.string(),
    lastName: z.string(),
    leadership: z.array(
      z.object({
        congress: z.number(),
        current: z.boolean(),
        type: z.string(),
      }),
    ),
    middleName: z.string().nullable(),
    nickName: z.string().nullable(),
    officialWebSiteUrl: z.string().optional(),
    party: z.string(),
    partyHistory: z.array(partyHistoryValidator),
    sponsoredLegislation: z.object({
      count: z.number(),
      url: z.string(),
    }),
    state: z.string(),
    suffixName: z.string().nullable(),
    terms: z.array(termResponseValidator),
    updateDate: z.string(),
  }),
  pagination: z
    .object({
      count: z.number().int(),
      next: z.string().url().nullish(),
    })
    .optional(),
  request: z.object({
    contentType: z.string(),
    format: z.string(),
  }),
})
