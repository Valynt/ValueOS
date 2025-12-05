import express from 'express';
import request from 'supertest';
import router from '../documents';

const app = express();
app.use(express.json());
app.use('/api/documents', router);

const csrfToken = 'test-token';
const csrfHeaders = {
  'x-csrf-token': csrfToken,
  Cookie: `csrf_token=${csrfToken}`
};

describe('Document upload lineage enforcement', () => {
  it('rejects uploads without lineage metadata', async () => {
    const res = await request(app)
      .post('/api/documents/upload')
      .set(csrfHeaders)
      .send({ content: 'example document' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/lineage metadata/i);
  });

  it('rejects uploads with unknown lineage values', async () => {
    const res = await request(app)
      .post('/api/documents/upload')
      .set(csrfHeaders)
      .send({
        content: 'example document',
        metadata: { source_origin: 'unknown', data_sensitivity_level: 'public' }
      });

    expect(res.status).toBe(400);
  });

  it('accepts uploads with lineage tags and returns evidence log', async () => {
    const res = await request(app)
      .post('/api/documents/upload')
      .set(csrfHeaders)
      .send({
        documentId: 'doc-123',
        content: 'example document',
        metadata: { source_origin: 'vendor_portal', data_sensitivity_level: 'confidential' }
      });

    expect(res.status).toBe(201);
    expect(res.body.data.lineage).toEqual({
      source_origin: 'vendor_portal',
      data_sensitivity_level: 'confidential'
    });
    expect(res.body.data.evidence_log).toMatch(/Lineage recorded/);
  });
});
