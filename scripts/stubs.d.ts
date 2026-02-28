// Wildcard declarations to prevent scripts/ typecheck from pulling in entire repo.
// Each declared module is treated as `any` which allows scripts to import without
// digging through app/package source and triggering unrelated errors.

declare module 'next/server';
declare module '@/*';
declare module '@/lib/*';
declare module '@/types/*';
declare module '@/services/*';
declare module '@/app/*';
declare module '../src/*';
declare module '../packages/*';
declare module '@prisma/client';
declare module 'bcryptjs';
declare module '@aws-sdk/*';

// Support the openai module if scripts import it
declare module 'openai';
