import React from 'react';
import PropTypes from 'prop-types';

import { dateAndTime } from '../../util/datetime';

const getRepoLastVerified = (site) => {
  let msg = 'Repository not found';
  if (site.repoLastVerified) {
    const formattedBuildTime = dateAndTime(site.repoLastVerified);
    msg += `. Last seen on ${formattedBuildTime}.`;
  }
  return msg;
};

const RepoLastVerified = ({ site, daysNotVerified = 5, userUpdated }) => {
  const daysAgo = fromDate => (new Date() - new Date(fromDate)) / (24 * 60 * 60 * 1000);
  const minutesAgo = fromDate => (new Date() - new Date(fromDate)) / (60 * 1000);
  if ((daysAgo(site.repoLastVerified || site.createdAt) > daysNotVerified)
    && (userUpdated && (minutesAgo(userUpdated) > 4))) { // user logged in 4 mins
    return (<p className="repo-verification">
      {getRepoLastVerified(site)}
    </p>);
  }
  return (null);
};

RepoLastVerified.propTypes = {
  site: PropTypes.shape({
    repoLastVerified: PropTypes.string,
    createdAt: PropTypes.string,
    userUpdated: PropTypes.string,
  }),
  daysNotVerified: PropTypes.number,
  userUpdated: PropTypes.string,
};

RepoLastVerified.defaultProps = {
  site: {},
  daysNotVerified: 5,
  userUpdated: new Date().toISOString(),
};

export default RepoLastVerified;
