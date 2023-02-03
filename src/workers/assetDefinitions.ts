// BullMQ
type FlowJob = {
  name: string
  queueName: string
  data?: any
  prefix?: string
  children?: FlowJob[]
  //   opts?: Omit<JobsOptions, 'parent' | 'repeat'>;
}

// Generics
type DataTypeOf<A> = A extends Asset<infer DataType, any, any>
  ? DataType
  : never
type AnyAsset = Asset<any, any, any>
type AssetArray = Array<AnyAsset>
type DataTypesOf<T extends AssetArray> = {
  [K in keyof T]: DataTypeOf<T[K]>
}

type Asset<T, A extends Array<any>, D extends Array<Asset<any, any, any>>> = {
  policies: (...args: A) => boolean
  materialize: (...deps: DataTypesOf<D>) => (...args: A) => T
  persist: (data: T) => void
}

type Engine = {
  materialize: (root: AnyAsset) => FlowJob
}

// CEL
type Chamber = 'H' | 'S'
type Step = 'BILL' | 'AIC' | 'ABC' | 'PASS' | 'LAW'

const listOfBillNumbersAsset: Asset<Array<number>, [Chamber, number], []> = {
  policies: (chamber: Chamber, congress: number): boolean => {
    throw new Error('Function not implemented.')
  },
  materialize:
    () =>
    (chamber: Chamber, congress: number): number[] => {
      throw new Error('Function not implemented.')
    },
  persist: (data: number[]): void => {
    throw new Error('Function not implemented.')
  },
}

const ImportantListAsset: Asset<Array<number>, [Chamber, number], []> = {
  policies: (chamber: Chamber, congress: number): boolean => {
    throw new Error('Function not implemented.')
  },
  materialize:
    () =>
    (chamber: Chamber, congress: number): number[] => {
      throw new Error('Function not implemented.')
    },
  persist: (data: number[]): void => {
    throw new Error('Function not implemented.')
  },
}

const StepRegexAsset: Asset<Map<Step, Array<RegExp>>, [Chamber], []> = {
  policies: (chamber: Chamber): boolean => {
    throw new Error('Function not implemented.')
  },
  materialize:
    () =>
    (chamber: Chamber): Map<Step, Array<RegExp>> => {
      throw new Error('Function not implemented.')
    },
  persist: (data: Map<Step, Array<RegExp>>): void => {
    throw new Error('Function not implemented.')
  },
}

const RankingPhraseAsset: Asset<Map<boolean, Array<RegExp>>, [Chamber], []> = {
  policies: (chamber: Chamber): boolean => {
    throw new Error('Function not implemented.')
  },
  materialize:
    () =>
    (chamber: Chamber): Map<boolean, Array<RegExp>> => {
      throw new Error('Function not implemented.')
    },
  persist: (data: Map<boolean, Array<RegExp>>): void => {
    throw new Error('Function not implemented.')
  },
}

const ListOfBillsJSONAsset: Asset<
  Array<Array<string>>,
  [Chamber, number],
  [typeof listOfBillNumbersAsset]
> = {
  policies: (chamber: Chamber, congress: number): boolean => {
    throw new Error('Function not implemented.')
  },
  materialize:
    (listOfBillNumbers: number[]) =>
    (chamber: Chamber, congress: number): string[][] => {
      throw new Error('Function not implemented.')
    },
  persist: (data: string[][]): void => {
    throw new Error('Function not implemented.')
  },
}

const ListOfBillActionsJSONAsset: Asset<
  Array<Array<string>>,
  [Chamber, number],
  [typeof listOfBillNumbersAsset]
> = {
  policies: (chamber: Chamber, congress: number): boolean => {
    throw new Error('Function not implemented.')
  },
  materialize:
    (listOfBillNumbers: number[]) =>
    (chamber: Chamber, congress: number): string[][] => {
      throw new Error('Function not implemented.')
    },
  persist: (data: string[][]): void => {
    throw new Error('Function not implemented.')
  },
}

const MembersListJSONAsset: Asset<Array<string>, [Chamber, number], []> = {
  policies: (chamber: Chamber, congress: number): boolean => {
    throw new Error('Function not implemented.')
  },
  materialize:
    () =>
    (chamber: Chamber, congress: number): string[] => {
      throw new Error('Function not implemented.')
    },
  persist: (data: string[]): void => {
    throw new Error('Function not implemented.')
  },
}

const MembersJSONAsset: Asset<
  Array<string>,
  [Chamber, number],
  [typeof MembersListJSONAsset]
> = {
  policies: (chamber: Chamber, congress: number): boolean => {
    throw new Error('Function not implemented.')
  },
  materialize:
    (membersListJSON: string[]) =>
    (chamber: Chamber, congress: number): string[] => {
      throw new Error('Function not implemented.')
    },
  persist: (data: string[]): void => {
    throw new Error('Function not implemented.')
  },
}

const StandardReportAsset: Asset<
  Array<number>,
  [Chamber, number],
  [
    typeof listOfBillNumbersAsset,
    typeof ListOfBillActionsJSONAsset,
    typeof ListOfBillsJSONAsset,
    typeof ImportantListAsset,
    typeof StepRegexAsset,
    typeof RankingPhraseAsset,
    typeof MembersListJSONAsset,
  ]
> = {
  policies: (chamber: Chamber, congress: number): boolean => {
    throw new Error('Function not implemented.')
  },
  materialize:
    (
      listOfBillNums: number[],
      listOfBillActionsJSON: string[][],
      listOfBillsJSON: string[][],
      importantList: number[],
      stepRegex: Map<Step, RegExp[]>,
      rankingPhrase: Map<boolean, RegExp[]>,
      membersListJSON: string[],
    ) =>
    (chamber: Chamber, congress: number): number[] => {
      throw new Error('Function not implemented.')
    },
  persist: (data: number[]): void => {
    throw new Error('Function not implemented.')
  },
}
