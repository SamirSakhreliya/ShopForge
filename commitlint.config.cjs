module.exports = {
  // Custom parser pattern to support multiple [JIRA-123] blocks
  parserPreset: {
    parserOpts: {
      headerPattern: /^(\w+):((\[[A-Z]+-\d+\])+)\s(.+)$/,
      headerCorrespondence: ['type', 'tickets', 'tickets', 'subject'],
    },
  },
  rules: {
    'type-enum': [
      2,
      'always',
      ['feature', 'fix', 'chore', 'docs', 'test', 'refactor'],
    ],
    'subject-empty': [2, 'never'],
    'type-empty': [2, 'never'],
    'header-max-length': [2, 'always', 120],
  },
};
