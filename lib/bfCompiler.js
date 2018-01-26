'use strict';

function genInst(inst, depth) {
  return '  '.repeat(depth * 2) + inst + '\n';
}

function genCode(code, depth) {
  let result = '';
  for (const i of code) {
    if (Array.isArray(i)) {
      result += genInst(`    (block ;; [`, depth);
      result += genInst(`      (loop`, depth);
      result += genInst(
        `        (br_if 1 (i32.eqz (i32.load8_s (get_local $ptr))))`,
        depth
      );
      result += genCode(i, depth + 1);
      result += genInst(`        (br 0)`, depth);
      result += genInst('      )', depth);
      result += genInst('    ) ;; ]', depth);
    } else if (i === '>') {
      result += genInst(
        '    (set_local $ptr (i32.add (get_local $ptr) (i32.const 1))) ;; >',
        depth
      );
    } else if (i === '<') {
      result += genInst(
        '    (set_local $ptr (i32.sub (get_local $ptr) (i32.const 1))) ;; <',
        depth
      );
    } else if (i === '+') {
      result += genInst(
        '    (i32.store8 (get_local $ptr) (i32.add (i32.load8_s (get_local $ptr)) (i32.const 1))) ;; +',
        depth
      );
    } else if (i === '-') {
      result += genInst(
        '    (i32.store8 (get_local $ptr) (i32.sub (i32.load8_s (get_local $ptr)) (i32.const 1))) ;; -',
        depth
      );
    } else if (i === '.') {
      result += genInst(
        '    (i32.load8_s (get_local $ptr)) (call $putchar) ;; .',
        depth
      );
    } else if (i === ',') {
      result += genInst(
        '    (i32.store8 (get_local $ptr) (call $getchar)) ;; ,',
        depth
      );
    }
  }
  return result;
}

function compile(bfCode, opts) {
  let imports
  if (opts.ewasm) {
    // This is pretty dumb at the moment. Allocate 256 bytes for output buffer.
    // Memory layout:
    // 0: read buffer
    // 1 .. 256: write buffer
    // 257 .. end: bf memory
    imports = `
  (func $callDataCopy (import "ethereum" "callDataCopy") (param i32 i32 i32))
  (func $return (import "ethereum" "return") (param i32 i32))
  (global $writeptr (mut i32) (i32.const 1))
  (global $readptr (mut i32) (i32.const 0))
  (func $getchar
    (result i32)
    (call $callDataCopy (get_global $readptr) (i32.const 0) (i32.const 1))
    (set_global $readptr (i32.add (get_global $readptr) (i32.const 1)))
    (i32.load8_u (i32.const 0))
  )
  (func $putchar
    (param $value i32)
    (i32.store8 (get_global $writeptr) (get_local $value))
    (set_global $writeptr (i32.add (get_global $writeptr) (i32.const 1)))
    ;; verify we do not overwrite 256 bytes here..
  )
`;
  } else {
    imports = `
  (func $getchar (import "imports" "getchar") (result i32))
  (func $putchar (import "imports" "putchar") (param i32))
`;
  }

  let prologue = `(module
  ${imports}
  (memory $0 (export "memory") 1 1)

  (func (export "main") (local $ptr i32) (set_local $ptr (i32.const 257))
`;
  let epilogue = `  )
)
`;

  if (opts.ewasm) {
    epilogue = `
  (call $return (i32.const 1) (i32.sub (get_global $writeptr) (i32.const 1)))
  ${epilogue}`
  }

  const wast = `${prologue}${genCode(bfCode, 0)}${epilogue}`;
  if (opts.verbose || process.env.NODE_ENV === 'debug') {
    console.log(wast);
  }
  return wast;
}

exports.compile = compile;
