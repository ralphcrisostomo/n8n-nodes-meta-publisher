export type Platform = 'instagram' | 'facebook' | 'threads';

export type IgStatusCode = 'IN_PROGRESS' | 'FINISHED' | 'ERROR';
export type ThreadsStatusCode = 'IN_PROGRESS' | 'FINISHED' | 'PUBLISHED' | 'ERROR' | 'EXPIRED';

// Reusable status union for parent/children across IG + Threads
export type ChildStatus = IgStatusCode | ThreadsStatusCode | 'UNKNOWN';

export type CarouselItem = {
	type: 'image' | 'video';
	url: string;
	caption?: string;
	altText?: string;
	userTags?: { username: string; x: number; y: number }[];
};

export type PublishResult = {
	id: string;
	platform: Platform;
	type: 'image' | 'video' | 'reel' | 'story' | 'carousel' | 'text';
	creationId?: string; // IG/Threads container or parent
	children?: string[]; // for carousels
	childStatuses?: Record<string, ChildStatus>; // map: childId -> status
	status?: string; // platform status
	published?: boolean;
	publishResult?: any; // media/thread object
	result?: any; // FB photo response, etc.
	videoId?: string; // FB video id
	photoIds?: string[];
	photoCount?: number;
	permalink?: any;
};
