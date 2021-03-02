import { ConcolicValue } from "../Values/WrappedValue";
import Log from "../Utilities/Log";
import External from "../External";
import Proc from "../Values/Procedure";

const Z3 = External.load("z3javascript").default;

const find = Array.prototype.find;

export default function(state, ctx, model, helpers) {

  const mkIndexSymbol = helpers.mkIndexSymbol;
  const symbolicHook = helpers.symbolicHook;
  const symbolicSubstring = helpers.substring;
  const coerceToString = helpers.coerceToString;
  const mkFunctionName = helpers.mkFunctionName;

  /**
  * Stubs string constructor with our (flaky) coerceToString fn
  */
  model.add(String, symbolicHook(
    String,
    (_base, args) => state.isSymbolic(args[0]),
    (_base, args, _result) => coerceToString(args[0])
  ));

  const substrModel = symbolicHook(
    String.prototype.substr,
    (base, args) => typeof state.getConcrete(base) === "string"
    && (state.isSymbolic(base) || state.isSymbolic(args[0]) || state.isSymbolic(args[1])),
    symbolicSubstring
  );

  model.add(String.prototype.includes, symbolicHook(
    String.prototype.includes,
    (base, args) => typeof state.getConcrete(base) === "string" && state.isSymbolic(base) || state.isSymbolic(args[0]),
    (base, args, result) => {

      //Theory:
      //base = string, args[0] coerced to string if not string
      //If there exists some i such that substr(base, i, length args[0]) == args[0] then true
      //Otherwise false

      args[0] = coerceToString(args[0]);

      let startPosition_obj = mkIndexSymbol('Includes_Start');
      let startPosition_s = startPosition_obj.sym;
      let startPosition_p = startPosition_obj.proc;
      let substringPart_s = ctx.mkSeqSubstr(
        state.asSymbolic(base),
        startPosition_s,
        state.asSymbolic(args[0]).getLength()
      );
      let substringPart_p = new Proc("mkSeqSubstr", [
        state.asProcedure(base),
        startPosition_p,
        state.asSymbolic(args[0]).getLength()
      ]);

      return new ConcolicValue(
        result,
        ctx.mkEq(substringPart_s, state.asSymbolic(args[0])),
        new Proc("mkEq", [substringPart_p, state.asProcedure(args[0])]),
        []
      );
    }
  ));
  model.add(String.prototype.substr, substrModel);
  model.add(String.prototype.substring, substrModel);
  model.add(String.prototype.slice, symbolicHook(
    String.prototype.slice,
    (base, args) => typeof state.getConcrete(base) === "string" && (state.isSymbolic(base) || state.isSymbolic(args[0]) || state.isSymbolic(args[1])),
    (base, args, result) => {

      function relativeIndex(i) {
        const con = state.getConcrete(i) < 0 ? state.getConcrete(base).length - state.getConcrete(i) : state.getConcrete(i);
        const sym = ctx.mkIte(
          ctx.mkLt(state.asSymbolic(i), ctx.mkIntVal(0)),
          ctx.mkSub(state.asSymbolic(base).getLength(), ctx.mkMul(state.asSymbolic(i), ctx.mkIntVal(-1))),
          state.asSymbolic(i)
        );
        const proc = new Proc("mkIte", [
          new Proc("mkLt", [state.asProcedure(i), new Proc("mkIntVal", [0])]),
          new Proc("mkSub", [
            new Proc("getLength", [state.asProcedure(base)]),
            new Proc("mkMul", [state.asProcedure(i), new Proc("mkIntVal", [-1])])
          ]),
          state.asProcedure(i)
        ]);
        return new ConcolicValue(con, sym, proc, []);
      }

      const from = relativeIndex(args[0]);

      let to;

      if (args[1]) {
        to = relativeIndex(args[1]);
      } else {
        to = new ConcolicValue(
          state.getConcrete(base).length,
          state.asSymbolic(base).getLength(),
          new Proc("getLength", [state.asProcedure(base)]),
          []
        );
      }

      const binary = state.binary('-', to, from);
      const startIndex_s = ctx.mkRealToInt(state.asSymbolic(from));
      const length_s = ctx.mkRealToInt(state.asSymbolic(binary));
      const startIndex_p = new Proc("mkRealToInt", [state.asProcedure(from)]);
      const length_p = new Proc("mkRealToInt", [state.asProcedure(binary)]);

      return new ConcolicValue(
        result,
        ctx.mkSeqSubstr(
          state.asSymbolic(base),
          startIndex_s,
          length_s
        ),
        new Proc("mkSeqSubstr", [
          state.asProcedure(base),
          startIndex_p,
          length_p
        ]),
        []
      );
    }
  ));

  model.add(String.prototype.charAt, symbolicHook(
    String.prototype.charAt,
    (base, args) => {
      const is_symbolic = (state.isSymbolic(base) || state.isSymbolic(args[0]));
      const is_well_formed = typeof state.getConcrete(base) === "string" && typeof state.getConcrete(args[0]) === "number";
      return is_symbolic && is_well_formed;
    },
    (base, args, result) => {
      const index_s = ctx.mkRealToInt(state.asSymbolic(args[0]));
      const char_s = ctx.mkSeqAt(state.asSymbolic(base), index_s);
      const index_p = new Proc("mkRealToInt", [state.asProcedure(args[0])]);
      const char_p = new Proc("mkSeqAt", [state.asProcedure(base), index_p]);
      return new ConcolicValue(result, char_s, char_p, []);
    }
  ));

  model.add(String.prototype.concat, symbolicHook(
    String.prototype.concat,
    (base, args) => state.isSymbolic(base) || find.call(args, arg => state.isSymbolic(arg)),
    (base, args, result) => {
      const arg_s_list = Array.prototype.map.call(args, arg => state.asSymbolic(arg));
      const arg_p_list = Array.prototype.map.call(args, arg => state.asProcedure(arg));
      const concat_s = ctx.mkSeqConcat([state.asSymbolic(base)].concat(arg_s_list));
      const concat_p = new Proc("mkSeqConcat", [[state.asProcedure(base)].concat(arg_p_list)]);
      return new ConcolicValue(result, concat_s, concat_p, []);
    }
  ));

  model.add(String.prototype.indexOf, symbolicHook(
    String.prototype.indexOf,
    (base, args) => typeof state.getConcrete(base) === "string" && (state.isSymbolic(base) || state.isSymbolic(args[0]) || state.isSymbolic(args[1])),
    (base, args, result) => {
      const off_real_s = args[1] ? state.asSymbolic(args[1]) : state.asSymbolic(0);
      const off_s = ctx.mkRealToInt(off_real_s);
      const target_s = state.asSymbolic(coerceToString(args[0]));
      const seq_index_s = ctx.mkSeqIndexOf(state.asSymbolic(base), target_s, off_s);
      const off_real_p = args[1] ? state.asProcedure(args[1]) : state.asProcedure(0);
      const off_p = new Proc("mkRealToInt", [off_real_p]);
      const target_p = state.asProcedure(coerceToString(args[0]));
      const seq_index_p = new Proc("mkSeqIndexOf", [state.asProcedure(base), target_p, off_p]);
      return new ConcolicValue(result, seq_index_s, seq_index_p, []);
    }
  ));

  //TODO: Fix LastIndexOf models
  model.add(String.prototype.lastIndexOf, symbolicHook(
    String.prototype.lastIndexOf,
    (base, args) => typeof state.getConcrete(base) === "string" && (state.isSymbolic(base) || state.isSymbolic(args[0]) || state.isSymbolic(args[1])),
    (base, args, result) => {
      const off_real_s = args[1] ? state.asSymbolic(args[1]) : state.asSymbolic(0);
      const off_s = ctx.mkRealToInt(off_real_s);
      const target_s = state.asSymbolic(coerceToString(args[0]));
      const seq_index_s = ctx.mkSeqIndexOf(state.asSymbolic(base), target_s, off_s);
      const off_real_p = args[1] ? state.asProcedure(args[1]) : state.asProcedure(0);
      const off_p = new Proc("mkRealToInt", [off_real_p]);
      const target_p = state.asProcedure(coerceToString(args[0]));
      const seq_index_p = new Proc("mkSeqIndexOf", [state.asProcedure(base), target_p, off_p]);
      return new ConcolicValue(result, seq_index_s, seq_index_p, []);
    }
  ));

  /*
  model.add(String.prototype.lastIndexOf, symbolicHook(
  String.prototype.lastIndexOf,
  (base, args) => typeof state.getConcrete(base) === "string" && (state.isSymbolic(base) || state.isSymbolic(args[0]) || state.isSymbolic(args[1])),
  (base, args, result) => {

  //Theory: Similar to indexOf
  //n = indexOf s p q where q == args[1] || length(base)
  //n != -1 => Not (Exists n < i < length s s.t. indexOf s t  == i)

  const off_real = args[1] ? state.asSymbolic(args[1]) : state.asSymbolic(base).getLength();
  const off_s = ctx.mkRealToInt(off_real);
  const actualIndex = mkIndexSymbol('LastIndexOf_Start_Position');

  const target_s = state.asSymbolic(coerceToString(args[0]));
  const seq_index = ctx.mkSeqIndexOf(state.asSymbolic(base), target_s, actualIndex);

  Log.log('WARN: lastIndexOf LOSS OF PRECISION does not guarentee last index');

  //Test for if there are later matches
  const intSort = ctx.mkIntSort();
  const i = ctx.mkBound(0, intSort);
  const notMatch = ctx.mkEq(ctx.mkSeqIndexOf(state.asSymbolic(base), target_s, i), ctx.mkIntVal(-1));

  const bounds = ctx.mkPattern([
  ctx.mkLt(i, state.asSymbolic(base).getLength()),
  ctx.mkGt(i, seq_index)
]);

const noLaterMatches = ctx.mkForAll([mkFunctionName("lastIndexOf")], intSort, notMatch, [bounds]);
state.pushCondition(noLaterMatches, true);

return new ConcolicValue(result, seq_index);
}));
*/
model.add(String.prototype.repeat, symbolicHook(
  String.prototype.repeat,
  (base, a) => state.isSymbolic(base) || state.isSymbolic(a[0])
  && typeof(state.getConcrete(base)) == "string"
  && typeof(state.getConcrete(a[0])) == "number",
  (base, a, result) => {

    const num_repeats_s = state.asSymbolic(a[0]);
    const num_repeats_p = state.asProcedure(a[0]);
    state.pushCondition(
      ctx.mkGe(num_repeats_s, ctx.mkIntVal(0)),
      new Proc("mkGe", [num_repeats_p, new Proc("mkIntVal", [0])])
    );

    const result_s = ctx.mkApp(
      state.stringRepeat,
      [state.asSymbolic(base), ctx.mkRealToInt(num_repeats_s)]
    );
    const result_p = new Proc("mkApp", [
      state.stringRepeatProc,
      [state.asProcedure(base), new Proc("mkRealToInt", [num_repeats_p])]
    ]);
    return new ConcolicValue(result, result_s,result_p, []);
  }
));

function trimLeftSymbolic(base_s) {
  const whiteLeft = ctx.mkApp(state.whiteLeft, [base_s, ctx.mkIntVal(0)]);
  const strLen = base_s.getLength();
  const totalLength = ctx.mkSub(strLen, whiteLeft);
  return ctx.mkSeqSubstr(base_s, whiteLeft, totalLength);
}

function trimLeftProcedure(base_s, base_p) {
  const whiteLeft = new Proc("mkApp", [state.whiteLeftProc, [base_p, new Proc("mkIntVal", [0])]]);
  const strLen = new Proc("getLength", [base_p]);
  const totalLength = new Proc("mkSub", [strLen, whiteLeft]);
  return new Proc("mkSeqSubstr", [base_p, whiteLeft, totalLength]);
}

function trimRightSymbolic(base_s) {
  const strLen = base_s.getLength();
  const whiteRight = ctx.mkApp(state.whiteRight, [base_s, strLen]);
  const totalLength = ctx.mkAdd(whiteRight, ctx.mkIntVal(1));
  return ctx.mkSeqSubstr(base_s, ctx.mkIntVal(0), totalLength);
}

function trimRightProcedure(base_s, base_p) {
  const strLen = new Proc("getLength", [base_p]);
  const whiteRight = new Proc("mkApp", [state.whiteRightProc, [base_p, strLen]]);
  const totalLength = new Proc("mkAdd", [whiteRight, new Proc("mkIntVal", [1])]);
  return new Proc("mkSeqSubstr", [base_p, new Proc("mkIntVal", [0]), totalLength]);
}

model.add(String.prototype.trimRight, symbolicHook(
  String.prototype.trim,
  (base, _a) => state.isSymbolic(base) && typeof(state.getConcrete(base).valueOf()) === "string",
  (base, _a, result) => {
    const base_s = state.asSymbolic(base);
    const base_p = state.asProcedure(base);
    return new ConcolicValue(result, trimRightSymbolic(base_s), trimRightProcedure(base_s, base_p), []);
  }
));

model.add(String.prototype.trimLeft, symbolicHook(
  String.prototype.trim,
  (base, _a) => state.isSymbolic(base) && typeof(state.getConcrete(base).valueOf()) === "string",
  (base, _a, result) => {
    const base_s = state.asSymbolic(base);
    const base_p = state.asProcedure(base);
    return new ConcolicValue(result, trimLeftSymbolic(base_s), trimLeftProcedure(base_s, base_p), []);
  }
));

model.add(String.prototype.trim, symbolicHook(
  String.prototype.trim,
  (base, _a) => state.isSymbolic(base) && typeof(state.getConcrete(base).valueOf()) === "string",
  (base, _a, result) => {
    const base_s = state.asSymbolic(base);
    const base_p = state.asProcedure(base);
    return new ConcolicValue(
      result,
      trimRightSymbolic(trimLeftSymbolic(base_s)),
      trimRightProcedure(trimLeftProcedure(base_s, base_p)),
      []
    );
  }
));

model.add(String.prototype.toLowerCase, symbolicHook(
  String.prototype.toLowerCase,
  (base, _a) => state.isSymbolic(base) && typeof(state.getConcrete(base).valueOf()) === "string",
  (base, _a, result) => {
    base = coerceToString(base);

    state.pushCondition(
      ctx.mkSeqInRe(state.asSymbolic(base), Z3.Regex(ctx, /^[^A-Z]+$/).ast),
      new Proc("mkSeqInRe", [state.asProcedure(base), new Proc("getZ3RegexAst")]),
      true
    );

    return new ConcolicValue(result, state.asSymbolic(base), state.asProcedure(base), []);
  }
));

}
