/**
 * ESLint rule to require explanatory comments for skipped tests
 *
 * Enforces that any use of .skip (it.skip, describe.skip, test.skip)
 * must have a comment immediately preceding it explaining why the test is skipped.
 *
 * Inspired by: https://github.com/cypress-io/eslint-plugin-dev/pull/15
 */

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require explanatory comments for skipped tests',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      missingComment: 'Skipped test must have a comment explaining why it is skipped',
    },
    schema: [],
  },

  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();

    /**
     * Check if a node is a skipped test (it.skip, describe.skip, test.skip)
     */
    function isSkippedTest(node) {
      if (node.type !== 'CallExpression') {
        return false;
      }

      const { callee } = node;

      // Check for it.skip(), describe.skip(), test.skip()
      if (callee.type === 'MemberExpression') {
        const objectName = callee.object.name;
        const propertyName = callee.property.name;

        return (
          (objectName === 'it' || objectName === 'describe' || objectName === 'test') &&
          propertyName === 'skip'
        );
      }

      return false;
    }

    /**
     * Check if there's a comment immediately before the node
     */
    function hasCommentBefore(node) {
      const comments = sourceCode.getCommentsBefore(node);

      if (comments.length === 0) {
        return false;
      }

      // Check if the last comment is on the line immediately before
      const lastComment = comments[comments.length - 1];
      const commentEndLine = lastComment.loc.end.line;
      const nodeStartLine = node.loc.start.line;

      // Comment should be on the line immediately before, or on the same line
      return nodeStartLine - commentEndLine <= 1;
    }

    return {
      CallExpression(node) {
        if (isSkippedTest(node) && !hasCommentBefore(node)) {
          context.report({
            node,
            messageId: 'missingComment',
          });
        }
      },
    };
  },
};
