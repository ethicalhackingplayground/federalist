const nock = require('nock');
const config = require('../../../config');

const getAccessToken = ({ authorizationCode, accessToken, scope } = {}) => {
  /* eslint-disable no-param-reassign */
  authorizationCode = authorizationCode || 'auth-code-123abc';
  accessToken = accessToken || 'access-token-123abc';

  if (scope && typeof scope !== 'string') {
    scope = scope.join(',');
  } else {
    scope = 'user,repo';
  }
  /* eslint-enable no-param-reassign */

  return nock('https://github.com')
    .post('/login/oauth/access_token', (body) => {
      const expectedBody = {
        client_id: config.passport.github.options.clientID,
        client_secret: config.passport.github.options.clientSecret,
        code: authorizationCode,
      };
      return body.client_id === expectedBody.client_id &&
        body.client_secret === expectedBody.client_secret &&
        body.code === expectedBody.code;
    })
    .reply(200, {
      token_type: 'bearer',
      scope,
      access_token: accessToken,
    });
};

const createRepoForOrg = ({ accessToken, org, repo, response } = {}) => {
  let createRepoNock = nock('https://api.github.com');

  if (org && repo) {
    createRepoNock = createRepoNock.post(`/orgs/${org}/repos`, {
      name: repo,
    });
  } else {
    createRepoNock = createRepoNock.post(/\/orgs\/.*\/repos/);
  }

  if (accessToken) {
    createRepoNock = createRepoNock.query({ access_token: accessToken });
  } else {
    createRepoNock = createRepoNock.query(true);
  }

  const typicalResponse = {
    owner: { login: org },
    name: repo,
  };

  let resp = response || 201;
  if (typeof resp === 'number') {
    resp = [resp, typicalResponse];
  } else if (resp[1] === undefined) {
    resp[1] = typicalResponse;
  }

  return createRepoNock.reply(...resp);
};

const createRepoForUser = ({ accessToken, repo, response } = {}) => {
  let createRepoNock = nock('https://api.github.com');

  if (repo) {
    createRepoNock = createRepoNock.post('/user/repos', {
      name: repo,
    });
  } else {
    createRepoNock = createRepoNock.post('/user/repos');
  }

  if (accessToken) {
    createRepoNock = createRepoNock.query({ access_token: accessToken });
  } else {
    createRepoNock = createRepoNock.query(true);
  }

  const typicalResponse = {
    owner: { login: 'your-name-here' },
    name: repo,
  };

  let resp = response || 201;
  if (typeof resp === 'number') {
    resp = [resp, typicalResponse];
  } else if (resp[1] === undefined) {
    resp[1] = typicalResponse;
  }

  return createRepoNock.reply(...resp);
};

const user = ({ accessToken, githubUserID, username, email } = {}) => {
  /* eslint-disable no-param-reassign */
  accessToken = accessToken || 'access-token-123abc';

  const userID = githubUserID || Math.floor(Math.random() * 10000);
  username = (username || `user-${userID}`).toUpperCase();
  email = email || `${username}@example.com`.toLowerCase();
  /* eslint-enable no-param-reassign */

  const expectedHeaders = {
    reqheaders: { authorization: `Bearer ${accessToken}` },
  };

  return nock('https://api.github.com', expectedHeaders)
    .get('/user')
    .reply(200, {
      email,
      login: username,
      id: githubUserID,
    });
};

const userOrganizations = ({ accessToken, organizations, response } = {}) => {
  /* eslint-disable no-param-reassign */
  accessToken = accessToken || 'access-token-123abc';
  organizations = organizations || [{ id: 123456 }];
  /* eslint-enable no-param-reassign */

  return nock('https://api.github.com')
    .get(`/user/orgs?access_token=${accessToken}`)
    .reply(response || 200, organizations);
};

const githubAuth = (username, organizations) => {
  getAccessToken();
  user({ username });
  userOrganizations({ organizations });
};

// eslint-disable-next-line no-shadow
const repo = ({ accessToken, owner, repo, username, response } = {}) => {
  let webhookNock = nock('https://api.github.com');

  if (owner && repo) {
    webhookNock = webhookNock.get(`/repos/${owner}/${repo}`);
  } else {
    webhookNock = webhookNock.get(/\/repos\/.*\/.*/);
  }

  if (accessToken && username) {
    webhookNock = webhookNock.query({ access_token: accessToken, username });
  } else if (accessToken) {
    webhookNock = webhookNock.query({ access_token: accessToken });
  } else if (username) {
    webhookNock = webhookNock.query({ username });
  } else {
    webhookNock = webhookNock.query(true);
  }

  const typicalResponse = {
    permissions: {
      admin: true,
      push: true,
      pull: true,
    },
  };

  let resp = response || 201;
  if (typeof resp === 'number') {
    resp = [resp, typicalResponse];
  } else if (resp[1] === undefined) {
    resp[1] = typicalResponse;
  }

  return webhookNock.reply(...resp);
};

// eslint-disable-next-line no-shadow
const status = ({ accessToken, owner, repo, sha, state, targetURL, response } = {}) => {
  let path;
  if (owner && repo && sha) {
    path = `/repos/${owner}/${repo}/statuses/${sha}`;
  } else {
    path = /\/repos\/.+\/.+\/statuses\/.+/;
  }

  let statusNock = nock('https://api.github.com').post(path, (body) => {
    if (state && body.state != state) { return false; }// eslint-disable-line eqeqeq

    if (targetURL && body.target_url !== targetURL) { return false; }

    const appEnv = config.app.app_env;
    if (appEnv === 'production' && body.context !== 'federalist/build') {
      return false;
    } else if (appEnv !== 'production' && body.context !== `federalist-${appEnv}/build`) {
      return false;
    }

    return true;
  });

  if (accessToken) {
    statusNock = statusNock.query({ access_token: accessToken });
  } else {
    statusNock = statusNock.query(true);
  }

  const typicalResponse = { id: 1 };

  let resp = response || 201;
  if (typeof resp === 'number') {
    resp = [resp, typicalResponse];
  } else if (resp[1] === undefined) {
    resp[1] = typicalResponse;
  }

  return statusNock.reply(...resp);
};

// eslint-disable-next-line no-shadow
const webhook = ({ accessToken, owner, repo, response } = {}) => {
  let webhookNock = nock('https://api.github.com');

  if (owner && repo) {
    webhookNock = webhookNock.post(`/repos/${owner}/${repo}/hooks`, {
      name: 'web',
      active: true,
      config: {
        url: config.webhook.endpoint,
        secret: config.webhook.secret,
        content_type: 'json',
      },
    });
  } else {
    webhookNock = webhookNock.post(/\/repos\/.*\/.*\/hooks/);
  }

  if (accessToken) {
    webhookNock = webhookNock.query({ access_token: accessToken });
  } else {
    webhookNock = webhookNock.query(true);
  }

  let resp = response || 201;
  if (typeof resp === 'number') {
    resp = [resp];
  }

  return webhookNock.reply(...resp);
};

// eslint-disable-next-line no-shadow
const getBranch = ({ accessToken, owner, repo, branch, expected }) => {
  let branchNock = nock('https://api.github.com');
  const path = `/repos/${owner}/${repo}/branches/${branch}`;

  branchNock = branchNock.get(path);

  if (accessToken) {
    branchNock = branchNock.query({ access_token: accessToken });
  } else {
    branchNock = branchNock.query(true);
  }

  const output = expected || {
    name: 'master',
    commit: {
      sha: 'a172b66c31e19d456a448041a5b3c2a70c32d8b7',
    },
  };

  return branchNock.reply(200, output);
};

/* eslint-disable camelcase */
const getOrganizationMembers = ({ accessToken, organization, role, per_page, page, response, responseCode }) => {
  /* eslint-disable no-param-reassign */
  accessToken = accessToken || 'access-token-123abc';
  organization = organization || 'test-org';
  per_page = per_page || 100;
  page = page || 1;
  role = role || 'all';
  /* eslint-enable no-param-reassign */

  const orgMembers = [];
  for (let i = 0; i < (per_page + 1); i += 1) {
    if ((i % 50) === 0) {
      if (role !== 'member') {
        orgMembers.push({ login: `admin-${organization}-${i}` });
      }
    } else if (role !== 'admin') {
      orgMembers.push({ login: `user-${organization}-${i}` });
    }
  }

  return nock('https://api.github.com')
    .get(`/orgs/${organization}/members?access_token=${accessToken}&per_page=${per_page}&page=${page}&role=${role}`)
    .reply(responseCode || 200, response || orgMembers.slice(((page - 1) * per_page), (page * per_page)));
};

const getTeamMembers = ({ accessToken, team_id, per_page, page, response } = {}) => {
  /* eslint-disable no-param-reassign */
  accessToken = accessToken || 'access-token-123abc';
  team_id = team_id || 'test-team';
  per_page = per_page || 100;
  page = page || 1;
  /* eslint-enable no-param-reassign */

  const teamMembers = [];
  for (let i = 0; i < (per_page + 2); i += 1) {
    teamMembers.push({ login: `user-${team_id}-${i}` });
  }

  return nock('https://api.github.com')
    .get(`/teams/${team_id}/members?access_token=${accessToken}&per_page=${per_page}&page=${page}`)
    .reply(response || 200, teamMembers.slice(((page - 1) * per_page), page * per_page));
};

const getRepositories = ({ accessToken, per_page, page, response }) => {
  /* eslint-disable no-param-reassign */
  accessToken = accessToken || 'access-token-123abc';
  per_page = per_page || 100;
  page = page || 1;
  /* eslint-enable no-param-reassign */

  const repos = [];
  for (let i = 0; i < (per_page + 1); i += 1) {
    repos.push({ full_name: `owner/repo-${i}`, permissions: { push: true } });
  }

  return nock('https://api.github.com')
    .get(`/user/repos?access_token=${accessToken}&per_page=${per_page}&page=${page}`)
    .reply(response || 200, repos.slice(((page - 1) * per_page), (page * per_page)));
};

const getCollaborators = ({ accessToken, owner, repository, per_page, page, response }) => {
  /* eslint-disable no-param-reassign */
  accessToken = accessToken || 'access-token-123abc';
  per_page = per_page || 100;
  page = page || 1;
  owner = owner || 'owner';
  repository = repository || 'repo';
  /* eslint-enable no-param-reassign */

  const collabs = [];
  for (let i = 0; i < (per_page + 1); i += 1) {
    collabs.push({ login: `collaborator-${i}`, permissions: { push: true } });
  }

  return nock('https://api.github.com')
    .get(`/repos/${owner}/${repository}/collaborators?access_token=${accessToken}&per_page=${per_page}&page=${page}`)
    .reply(response || 200, collabs.slice(((page - 1) * per_page), (page * per_page)));
};
/* eslint-enable camelcase */

module.exports = {
  getAccessToken,
  createRepoForOrg,
  createRepoForUser,
  githubAuth,
  repo,
  status,
  user,
  userOrganizations,
  webhook,
  getBranch,
  getTeamMembers,
  getOrganizationMembers,
  getRepositories,
  getCollaborators,
};
