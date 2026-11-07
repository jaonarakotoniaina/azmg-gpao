process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST ?? 'postgresql://azmg:azmg@localhost:5432/azmg_gpao_test';
process.env.AI_PROVIDER = 'mock';
process.env.COLLECTE_MAIL = 'mock';
process.env.STORAGE_DIR = 'storage/test';
