import { useReducer } from 'react';
import { traceParamsEqual } from '../trace/settings';
import type { TraceParams } from '../trace/types';

interface HistoryState {
  present: TraceParams;
  past: TraceParams[];
  future: TraceParams[];
  lastGroup: string | null;
  lastEditAt: number;
}

type HistoryAction =
  | {
      type: 'update';
      updater: (current: TraceParams) => TraceParams;
      group: string;
      now: number;
      forceNew: boolean;
    }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'replace'; next: TraceParams };

const MAX_HISTORY = 60;
const COALESCE_MS = 700;

function reducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case 'update': {
      const next = action.updater(state.present);
      if (traceParamsEqual(state.present, next)) return state;
      const coalesce =
        !action.forceNew &&
        state.lastGroup === action.group &&
        action.now - state.lastEditAt < COALESCE_MS;
      const past = coalesce ? state.past : [...state.past, state.present].slice(-MAX_HISTORY);
      return {
        present: next,
        past,
        future: [],
        lastGroup: action.group,
        lastEditAt: action.now,
      };
    }
    case 'undo': {
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;
      return {
        present: previous,
        past: state.past.slice(0, -1),
        future: [state.present, ...state.future].slice(0, MAX_HISTORY),
        lastGroup: null,
        lastEditAt: 0,
      };
    }
    case 'redo': {
      const next = state.future[0];
      if (!next) return state;
      return {
        present: next,
        past: [...state.past, state.present].slice(-MAX_HISTORY),
        future: state.future.slice(1),
        lastGroup: null,
        lastEditAt: 0,
      };
    }
    case 'replace': {
      return {
        present: action.next,
        past: [],
        future: [],
        lastGroup: null,
        lastEditAt: 0,
      };
    }
  }
}

export interface TraceHistoryApi {
  params: TraceParams;
  canUndo: boolean;
  canRedo: boolean;
  update: (
    updater: (current: TraceParams) => TraceParams,
    group: string,
    forceNew?: boolean,
  ) => void;
  patch: (patch: Partial<TraceParams>, group: string, forceNew?: boolean) => void;
  undo: () => void;
  redo: () => void;
  replace: (next: TraceParams) => void;
}

export function useTraceHistory(initial: TraceParams): TraceHistoryApi {
  const [state, dispatch] = useReducer(reducer, {
    present: initial,
    past: [],
    future: [],
    lastGroup: null,
    lastEditAt: 0,
  });

  return {
    params: state.present,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    update: (updater, group, forceNew = false) => {
      dispatch({ type: 'update', updater, group, now: Date.now(), forceNew });
    },
    patch: (patch, group, forceNew = false) => {
      dispatch({
        type: 'update',
        updater: (current) => ({ ...current, ...patch }),
        group,
        now: Date.now(),
        forceNew,
      });
    },
    undo: () => dispatch({ type: 'undo' }),
    redo: () => dispatch({ type: 'redo' }),
    replace: (next) => dispatch({ type: 'replace', next }),
  };
}
