export function greet(name?: string): string {
	const target = name?.trim() || "there";
	return `Hello, ${target}!`;
}
