/*
 * Authenticated Resource Library client.
 * Catalog content comes from Postgres RLS; downloads come from a private
 * Storage bucket through short-lived signed URLs.
 */
(function (root) {
  'use strict';

  var BUCKET = 'resource-downloads';
  var SIGNED_URL_TTL_SECONDS = 60;
  var SELECT_FIELDS = [
    'id', 'title', 'category', 'skill', 'difficulty', 'duration_minutes',
    'summary', 'objectives', 'content', 'example', 'safe_practice',
    'related_label', 'related_route', 'downloads', 'review_date', 'status',
    'active'
  ].join(',');
  var CATEGORY_META = {
    script: { label: 'Script', plural: 'Scripts', icon: '📝' },
    template: { label: 'Template', plural: 'Templates', icon: '📋' },
    cheatsheet: { label: 'Cheat Sheet', plural: 'Cheat Sheets', icon: '⚡' },
    worksheet: { label: 'Worksheet', plural: 'Worksheets', icon: '📓' },
    interview: { label: 'Interview Prep', plural: 'Interview Prep', icon: '🎤' }
  };
  var SAFE_ID = /^[a-z0-9][a-z0-9-]*$/;
  var SAFE_FORMATS = new Set(['pdf', 'docx', 'xlsx']);

  function client() {
    if (typeof supabaseClient === 'undefined') {
      throw new Error('Resource service is unavailable.');
    }
    return supabaseClient;
  }

  async function verifiedUser(expectedId) {
    var result = await client().auth.getUser();
    if (result.error) throw result.error;
    var user = result.data && result.data.user;
    if (!user || (expectedId && user.id !== expectedId)) {
      var error = new Error('Your session has expired. Please sign in again.');
      error.code = 'AUTH_REQUIRED';
      throw error;
    }
    return user;
  }

  function normalizeDownload(resourceId, value) {
    var format = value && String(value.format || '').toLowerCase();
    if (!SAFE_FORMATS.has(format)) return null;
    return { format: format, path: resourceId + '.' + format };
  }

  function normalize(row) {
    if (!row || !SAFE_ID.test(String(row.id || ''))) return null;
    return {
      id: row.id,
      title: row.title,
      category: row.category,
      skill: row.skill,
      difficulty: row.difficulty,
      duration: row.duration_minutes,
      summary: row.summary,
      objectives: Array.isArray(row.objectives) ? row.objectives : [],
      sections: Array.isArray(row.content) ? row.content : [],
      example: row.example || null,
      safePractice: row.safe_practice || '',
      related: { label: row.related_label || '', route: row.related_route || '' },
      downloads: (Array.isArray(row.downloads) ? row.downloads : [])
        .map(function (item) { return normalizeDownload(row.id, item); })
        .filter(Boolean),
      reviewDate: row.review_date,
      status: row.status,
      active: row.active === true
    };
  }

  function assertPublished(resource) {
    return resource && resource.active === true && resource.status === 'reviewed';
  }

  async function listPublished() {
    var user = await verifiedUser();
    var result = await client()
      .from('resource_catalog')
      .select(SELECT_FIELDS)
      .eq('active', true)
      .eq('status', 'reviewed')
      .order('category')
      .order('title');
    if (result.error) throw result.error;
    await verifiedUser(user.id);
    return (result.data || []).map(normalize).filter(assertPublished);
  }

  async function getPublished(resourceId) {
    if (!SAFE_ID.test(String(resourceId || ''))) return null;
    var user = await verifiedUser();
    var result = await client()
      .from('resource_catalog')
      .select(SELECT_FIELDS)
      .eq('id', resourceId)
      .eq('active', true)
      .eq('status', 'reviewed')
      .maybeSingle();
    if (result.error) throw result.error;
    await verifiedUser(user.id);
    var resource = normalize(result.data);
    return assertPublished(resource) ? resource : null;
  }

  async function createSignedDownload(resourceId, format) {
    resourceId = String(resourceId || '');
    format = String(format || '').toLowerCase();
    if (!SAFE_ID.test(resourceId) || !SAFE_FORMATS.has(format)) {
      throw new Error('Invalid resource download.');
    }
    var user = await verifiedUser();
    var objectPath = resourceId + '.' + format;
    var result = await client().storage
      .from(BUCKET)
      .createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS, { download: true });
    if (result.error) throw result.error;
    await verifiedUser(user.id);
    if (!result.data || !result.data.signedUrl) {
      throw new Error('A secure download link could not be created.');
    }
    return result.data.signedUrl;
  }

  root.PrivateResourceStore = {
    bucket: BUCKET,
    categoryMeta: CATEGORY_META,
    listPublished: listPublished,
    getPublished: getPublished,
    createSignedDownload: createSignedDownload
  };
})(typeof window !== 'undefined' ? window : globalThis);
