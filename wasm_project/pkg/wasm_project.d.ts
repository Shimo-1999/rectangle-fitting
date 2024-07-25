/* tslint:disable */
/* eslint-disable */
/**
* @param {number} num_rectangles
* @param {number} width
* @param {number} height
* @param {Uint8Array} rgb_data
* @returns {(string)[]}
*/
export function run_greedy(num_rectangles: number, width: number, height: number, rgb_data: Uint8Array): (string)[];
/**
* @param {number} num_rectangles
* @param {number} width
* @param {number} height
* @param {Uint8Array} rgb_data
* @returns {(string)[]}
*/
export function run_simulated_annealing(num_rectangles: number, width: number, height: number, rgb_data: Uint8Array): (string)[];
/**
* @param {number} algorithm_id
* @param {number} num_rectangles
* @param {number} width
* @param {number} height
* @param {Uint8Array} image_data
* @returns {Ret}
*/
export function run_algorithm(algorithm_id: number, num_rectangles: number, width: number, height: number, image_data: Uint8Array): Ret;
/**
*/
export class Ret {
  free(): void;
/**
*/
  animation_data: (string)[];
/**
*/
  max_turn: number;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly run_greedy: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
  readonly run_simulated_annealing: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
  readonly __wbg_ret_free: (a: number) => void;
  readonly __wbg_get_ret_animation_data: (a: number, b: number) => void;
  readonly __wbg_set_ret_animation_data: (a: number, b: number, c: number) => void;
  readonly __wbg_get_ret_max_turn: (a: number) => number;
  readonly __wbg_set_ret_max_turn: (a: number, b: number) => void;
  readonly run_algorithm: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {SyncInitInput} module
*
* @returns {InitOutput}
*/
export function initSync(module: SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {InitInput | Promise<InitInput>} module_or_path
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: InitInput | Promise<InitInput>): Promise<InitOutput>;
