#!/usr/bin/env -S node --experimental-strip-types

import { Command } from "commander";
import { greet } from "./greet.mts";

const program = new Command();

program
	.name("batch-creative-api")
	.description("A basic TypeScript CLI template")
	.version("1.0.0");

program
	.command("greet")
	.description("Print a greeting")
	.argument("[name]", "name to greet")
	.action((name?: string) => {
		console.log(greet(name));
	});

program.parse();
