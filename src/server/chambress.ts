import { Chamber } from '@prisma/client'
import { Response } from 'node-fetch'
import { z } from 'zod'
import { some, none, Option } from 'fp-ts/lib/Option'

export const ChamberDisplay = z.enum(['House of Representatives', 'Senate'])
export type ChamberDisplay = z.infer<typeof ChamberDisplay>
export const ChamberToEnum: Record<ChamberDisplay, Chamber> = {
  'House of Representatives': Chamber.HOUSE,
  Senate: Chamber.SENATE,
}
export const ChamberToDisplay: Record<Chamber, ChamberDisplay> = {
  [Chamber.HOUSE]: 'House of Representatives',
  [Chamber.SENATE]: 'Senate',
}

export class CongressAPIError extends Error {
  public _tag: 'CongressAPIError'
  public response: Response
  private constructor(response: Response) {
    super(
      `congress API error response [${response.status}]: ${response.statusText}`,
    )
    this._tag = 'CongressAPIError'
    this.response = response
  }
  public static of(response: Response): CongressAPIError {
    return new CongressAPIError(response)
  }
}

export function congressToChambress({ name }: { name: string }): Option<
  Array<{
    congress: number
    chamber: Chamber
  }>
> {
  const congress = Number.parseInt(name)
  if (Number.isNaN(congress) || congress < 93) return none
  return some([
    { congress, chamber: Chamber.HOUSE },
    { congress, chamber: Chamber.SENATE },
  ])
}
