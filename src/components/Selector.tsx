import { Listbox, Transition } from '@headlessui/react'
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { Fragment } from 'react'

interface Props<T extends string> {
  label: string
  value: T
  options: T[]
  onChange: (v: T) => void
  displayNames?: Record<T, string>
}

export default function Selector<T extends string>({
  label,
  value,
  options,
  onChange,
  displayNames,
}: Props<T>) {
  return (
    <Listbox value={value} onChange={onChange}>
      {({ open }) => (
        <div className="flex flex-col">
          <Listbox.Label className="block text-sm font-medium">
            {label}
          </Listbox.Label>
          <div className="relative mt-1">
            <Listbox.Button
              className={clsx(
                'border-neutral-700 bg-neutral-800',
                'focus:border-indigo-500 focus:ring-indigo-500 ',
                'relative w-full cursor-default rounded-md border py-2 pl-3 pr-10 text-left shadow-sm focus:outline-none focus:ring-1 sm:text-sm',
              )}
            >
              <span className="block truncate">
                {displayNames?.[value] ?? value}
              </span>
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                <ChevronUpDownIcon className="h-5 w-5" aria-hidden="true" />
              </span>
            </Listbox.Button>

            <Transition
              show={open}
              as={Fragment}
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <Listbox.Options
                className={clsx(
                  'bg-neutral-800 ring-black',
                  'absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md py-1 text-base shadow-lg ring-1 ring-opacity-5 focus:outline-none sm:text-sm',
                )}
              >
                {options.map((option) => (
                  <Listbox.Option
                    key={option}
                    className={({ active }) =>
                      clsx(
                        active ? 'text-white bg-indigo-600' : '',
                        'relative cursor-default select-none py-2 pl-3 pr-9',
                      )
                    }
                    value={option}
                  >
                    {({ selected, active }) => (
                      <>
                        <span
                          className={clsx(
                            selected ? 'font-semibold' : 'font-normal',
                            'block truncate',
                          )}
                        >
                          {displayNames?.[option] ?? option}
                        </span>

                        {selected ? (
                          <span
                            className={clsx(
                              active ? 'text-white' : 'text-indigo-600',
                              'absolute inset-y-0 right-0 flex items-center pr-4',
                            )}
                          >
                            <CheckIcon className="h-5 w-5" aria-hidden="true" />
                          </span>
                        ) : null}
                      </>
                    )}
                  </Listbox.Option>
                ))}
              </Listbox.Options>
            </Transition>
          </div>
        </div>
      )}
    </Listbox>
  )
}
