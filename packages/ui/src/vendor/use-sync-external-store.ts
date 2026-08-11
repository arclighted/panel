/**
 * ESM drop-in for `use-sync-external-store/shim` and
 * `use-sync-external-store/shim/with-selector`.
 *
 * `@base-ui/react` and `@base-ui/utils` import these packages. They are CJS
 * and their production entries perform a runtime `require("react")`, which
 * bundlers cannot statically convert when `react` is externalized (the panel
 * app + addon bundles externalize react so a single instance is shared via
 * the import map). The leftover require shim throws in browser ESM.
 *
 * React 19 exports `useSyncExternalStore` natively, so this file re-exports
 * it. `useSyncExternalStoreWithSelector` is NOT exported by react, so its
 * canonical implementation (MIT, from the React team's use-sync-external-store
 * package) is vendored here, reading `useSyncExternalStore` from react.
 *
 * Both the app build and the @arclight/ui build alias
 * `use-sync-external-store/shim(/with-selector)?` here.
 */
import {
  useSyncExternalStore,
  useRef,
  useEffect,
  useMemo,
  useDebugValue,
} from "react"

export { useSyncExternalStore }

function is(x: unknown, y: unknown): boolean {
  return (x === y && (x !== 0 || 1 / (x as number) === 1 / (y as number))) || (x !== x && y !== y)
}

const objectIs: (a: unknown, b: unknown) => boolean =
  typeof Object.is === "function" ? Object.is : is

export function useSyncExternalStoreWithSelector<Snapshot, Selection>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => Snapshot,
  getServerSnapshot: (() => Snapshot) | undefined,
  selector: (snapshot: Snapshot) => Selection,
  isEqual?: (a: Selection, b: Selection) => boolean,
): Selection {
  const instRef = useRef<{
    hasValue: boolean
    value: Selection
  } | null>(null)
  let inst: { hasValue: boolean; value: Selection }
  if (instRef.current === null) {
    inst = { hasValue: false, value: null as unknown as Selection }
    instRef.current = inst
  } else {
    inst = instRef.current
  }

  const [getSelection, getServerSelection] = useMemo(
    () => {
      let hasMemo = false
      let memoizedSnapshot: Snapshot
      let memoizedSelection: Selection

      const memoizedSelector = (nextSnapshot: Snapshot): Selection => {
        if (!hasMemo) {
          hasMemo = true
          memoizedSnapshot = nextSnapshot
          const nextSelection = selector(nextSnapshot)
          if (isEqual !== undefined && inst.hasValue) {
            const currentSelection = inst.value
            if (isEqual(currentSelection, nextSelection)) {
              memoizedSelection = currentSelection
              return currentSelection
            }
          }
          memoizedSelection = nextSelection
          return nextSelection
        }
        const currentSelection = memoizedSelection
        if (objectIs(memoizedSnapshot, nextSnapshot)) {
          return currentSelection
        }
        const nextSelection = selector(nextSnapshot)
        if (isEqual !== undefined && isEqual(currentSelection, nextSelection)) {
          memoizedSnapshot = nextSnapshot
          return currentSelection
        }
        memoizedSnapshot = nextSnapshot
        memoizedSelection = nextSelection
        return nextSelection
      }

      const maybeGetServerSnapshot =
        getServerSnapshot === undefined ? null : getServerSnapshot
      return [
        () => memoizedSelector(getSnapshot()),
        maybeGetServerSnapshot === null
          ? undefined
          : () => memoizedSelector(maybeGetServerSnapshot()),
      ] as const
    },
    [getSnapshot, getServerSnapshot, selector, isEqual],
  )

  const value = useSyncExternalStore(subscribe, getSelection, getServerSelection)

  useEffect(() => {
    inst.hasValue = true
    inst.value = value
  }, [value])

  useDebugValue(value)
  return value
}
