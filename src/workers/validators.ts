import { z } from 'zod'

const requestValidator = z.object({
  billNumber: z.string(),
  billType: z.string(),
  congress: z.string(),
  contentType: z.string(),
  format: z.string(),
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
    committees: z.object({
      count: z.number(),
      url: z.string(),
    }),
    congress: z.number(),
    constitutionalAuthorityStatementText: z.string(),
    cosponsors: z.object({
      count: z.number(),
      countIncludingWithdrawnCosponsors: z.number(),
      url: z.string(),
    }),
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
    originChamber: z.string(),
    policyArea: z.object({
      name: z.string(),
    }),
    relatedBills: z
      .object({
        count: z.number(),
        url: z.string(),
      })
      .optional(),
    sponsors: z.array(
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
        district: z.number(),
      }),
    ),
    subjects: z.object({
      count: z.number(),
      url: z.string(),
    }),
    summaries: z.object({
      count: z.number(),
      url: z.string(),
    }),
    textVersions: z.object({
      count: z.number(),
      url: z.string(),
    }),
    title: z.string(),
    titles: z.object({
      count: z.number(),
      url: z.string(),
    }),
    type: z.string(),
    updateDate: z.string(),
    updateDateIncludingText: z.string(),
  }),
  request: requestValidator,
})

export const billActionsResponseValidator = z.object({
  actions: z.array(
    z.object({
      actionCode: z.string().optional(),
      actionDate: z.string(),
      acionTime: z.string().optional(),
      calendarNumber: z
        .object({
          calendar: z.string(),
          number: z.string().optional(),
        })
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
      recordedVotes: z
        .array(
          z.object({
            chamber: z.string(),
            congress: z.number(),
            date: z.string(),
            rollNumber: z.number(),
            sessionNumber: z.number(),
            url: z.string(),
          }),
        )
        .optional(),
      sourceSystem: z.object({
        code: z.number().optional(),
        name: z.string().optional(),
      }),
      text: z.string(),
      type: z.string(),
    }),
  ),
  pagination: z.object({
    count: z.number(),
  }),
  request: requestValidator,
})
