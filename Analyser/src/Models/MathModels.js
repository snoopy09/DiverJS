import { ConcolicValue } from "../Values/WrappedValue";
import Proc from "../Values/Procedure";

export default function(state, ctx, model, helper) {

	const symbolicHook = helper.symbolicHook;

	/**
	 * TODO: Floor and Ceil should -1 or +1 if args[0] > or < the result
	 */

	model.add(Math.floor, symbolicHook(
		Math.floor,
		(base, args) => state.isSymbolic(args[0]),
		(base, args, r) => {
			const intArg_s = ctx.mkRealToInt(state.asSymbolic(args[0]));
			const floored_s = ctx.mkIntToReal(intArg_s);
			const intArg_p = new Proc("mkRealToInt", [state.asProcedure(args[0])]);
			const floored_p = new Proc("mkIntToReal", [intArg_p]);
			return new ConcolicValue(r, floored_s, floored_p, []);
		}
	));

	model.add(Math.ceil, symbolicHook(
		Math.ceil,
		(base, args) => state.isSymbolic(args[0]),
		(base, args, r) => {
			const intArg_s = ctx.mkRealToInt(state.asSymbolic(args[0]));
			const floored_s = ctx.mkIntToReal(intArg_s);
			const intArg_p = new Proc("mkRealToInt", [state.asProcedure(args[0])]);
			const floored_p = new Proc("mkIntToReal", [intArg_p]);
			return new ConcolicValue(r, floored_s, floored_p, []);
		}
	));

	model.add(Math.round, symbolicHook(
		Math.round,
		(base, args) => state.isSymbolic(args[0]),
		(base, args, r) => {
			const intArg_s = ctx.mkRealToInt(state.asSymbolic(args[0]));
			const floored_s = ctx.mkIntToReal(intArg_s);
			const intArg_p = new Proc("mkRealToInt", [state.asProcedure(args[0])]);
			const floored_p = new Proc("mkIntToReal", [intArg_p]);
			return new ConcolicValue(r, floored_s, floored_p, []);
		}
	));

	model.add(Math.abs, symbolicHook(
		Math.abs,
		(base, args) => state.isSymbolic(args[0]),
		(base, args, r) => {
			const arg_s = state.asSymbolic(args[0]);
			const arg_p = state.asProcedure(args[0]);
			return new ConcolicValue(
				r,
				ctx.mkIte(ctx.mkLt(arg_s, state.asSymbolic(0)), ctx.mkUnaryMinus(arg_s), arg_s),
				new Proc("mkIte", [new Proc("mkLt", [arg_p, state.asProcedure(0)]), new Proc("mkUnaryMinus", [arg_p]), arg_p]),
				[]
			);
		}
	));

};
