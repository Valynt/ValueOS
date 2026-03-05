CREATE TABLE `enrichment_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyKey` varchar(255) NOT NULL,
	`companyName` varchar(255) NOT NULL,
	`data` json NOT NULL,
	`sourcesSucceeded` int NOT NULL DEFAULT 0,
	`confidence` int NOT NULL DEFAULT 0,
	`totalLatencyMs` int NOT NULL DEFAULT 0,
	`hitCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`refreshedAt` timestamp NOT NULL DEFAULT (now()),
	`lastHitAt` timestamp,
	CONSTRAINT `enrichment_cache_id` PRIMARY KEY(`id`),
	CONSTRAINT `enrichment_cache_companyKey_unique` UNIQUE(`companyKey`)
);
