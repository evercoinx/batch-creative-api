import type { ImageInput, Platform } from "./schema.mts";

export type ItemStatus = "pending" | "running" | "done" | "failed";

// One generated post for a single product image. In mock mode the imageUrl
// points at the placeholder sample; caption/hashtags/meta are canned.
export type Post = {
	imageUrl: string;
	caption: string;
	hashtags: string[];
	platform: Platform;
	meta: Record<string, unknown>;
};

export type BatchItem = {
	product: ImageInput;
	status: ItemStatus;
	post?: Post;
	error?: string;
};

export type BatchStatus = "pending" | "running" | "done";

export type Batch = {
	id: string;
	status: BatchStatus;
	platform: Platform;
	items: BatchItem[];
	createdAt: number;
};

// The view returned by GET /batches/:id — internal product input is dropped.
export type BatchView = {
	id: string;
	status: BatchStatus;
	platform: Platform;
	items: Array<Pick<BatchItem, "status" | "post" | "error">>;
};
