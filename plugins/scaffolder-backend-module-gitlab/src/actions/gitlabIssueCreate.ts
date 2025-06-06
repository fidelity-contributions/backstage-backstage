/*
 * Copyright 2023 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { InputError } from '@backstage/errors';
import { ScmIntegrationRegistry } from '@backstage/integration';
import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { IssueType } from '../commonGitlabConfig';
import { examples } from './gitlabIssueCreate.examples';
import { checkEpicScope, convertDate, getClient, parseRepoUrl } from '../util';
import { CreateIssueOptions, IssueSchema } from '@gitbeaker/rest';
import { getErrorMessage } from './helpers';

/**
 * Creates a `gitlab:issues:create` Scaffolder action.
 *
 * @param options - Templating configuration.
 * @public
 */
export const createGitlabIssueAction = (options: {
  integrations: ScmIntegrationRegistry;
}) => {
  const { integrations } = options;
  return createTemplateAction({
    id: 'gitlab:issues:create',
    description: 'Creates a Gitlab issue.',
    examples,
    schema: {
      input: {
        repoUrl: z =>
          z.string({
            description: `Accepts the format 'gitlab.com?repo=project_name&owner=group_name' where 'project_name' is the repository name and 'group_name' is a group or username`,
          }),
        token: z =>
          z
            .string({
              description: 'The token to use for authorization to GitLab',
            })
            .optional(),
        projectId: z =>
          z.number({
            description: 'Project Id',
          }),
        title: z =>
          z.string({
            description: 'Title of the issue',
          }),
        assignees: z =>
          z
            .array(z.number(), {
              description: 'IDs of the users to assign the issue to.',
            })
            .optional(),
        confidential: z =>
          z
            .boolean({
              description: 'Issue Confidentiality',
            })
            .optional(),
        description: z =>
          z
            .string({
              description: 'Issue description',
            })
            .max(1048576)
            .optional(),
        createdAt: z =>
          z
            .string({
              description: 'Creation date/time',
            })
            .regex(
              /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/,
              'Invalid date format. Use YYYY-MM-DDTHH:mm:ssZ or YYYY-MM-DDTHH:mm:ss.SSSZ',
            )
            .optional(),
        dueDate: z =>
          z
            .string({
              description: 'Due date/time',
            })
            .regex(
              /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/,
              'Invalid date format. Use YYYY-MM-DDTHH:mm:ssZ or YYYY-MM-DDTHH:mm:ss.SSSZ',
            )
            .optional(),
        discussionToResolve: z =>
          z
            .string({
              description:
                'Id of a discussion to resolve. Use in combination with "merge_request_to_resolve_discussions_of"',
            })
            .optional(),
        epicId: z =>
          z
            .number({
              description: 'Id of the linked Epic',
            })
            .min(0, 'Valid values should be equal or greater than zero')
            .optional(),
        labels: z =>
          z
            .string({
              description: 'Labels to apply',
            })
            .optional(),
        issueType: z =>
          z
            .nativeEnum(IssueType, {
              description: 'Type of the issue',
            })
            .optional(),
        mergeRequestToResolveDiscussionsOf: z =>
          z
            .number({
              description:
                'IID of a merge request in which to resolve all issues',
            })
            .optional(),
        milestoneId: z =>
          z
            .number({
              description: 'Global ID of a milestone to assign the issue',
            })
            .optional(),
        weight: z =>
          z
            .number({
              description: 'The issue weight',
            })
            .min(0)
            .refine(
              value => {
                return value >= 0;
              },
              {
                message: 'Valid values should be equal or greater than zero',
              },
            )
            .optional(),
      },
      output: {
        issueUrl: z =>
          z.string({
            description: 'Issue Url',
          }),
        issueId: z =>
          z.number({
            description: 'Issue Id',
          }),
        issueIid: z =>
          z.number({
            description: 'Issue Iid',
          }),
      },
    },
    async handler(ctx) {
      try {
        const {
          repoUrl,
          projectId,
          title,
          description = '',
          confidential = false,
          assignees = [],
          createdAt = '',
          dueDate,
          discussionToResolve = '',
          epicId,
          labels = '',
          issueType,
          mergeRequestToResolveDiscussionsOf,
          milestoneId,
          weight,
          token,
        } = ctx.input;

        const { host } = parseRepoUrl(repoUrl, integrations);
        const api = getClient({ host, integrations, token });

        let isEpicScoped = false;

        isEpicScoped = await ctx.checkpoint({
          key: `is.epic.scoped.${projectId}.${title}`,
          fn: async () => {
            if (epicId) {
              isEpicScoped = await checkEpicScope(api, projectId, epicId);

              if (isEpicScoped) {
                ctx.logger.info('Epic is within Project Scope');
              } else {
                ctx.logger.warn(
                  'Chosen epic is not within the Project Scope. The issue will be created without an associated epic.',
                );
              }
            }
            return isEpicScoped;
          },
        });

        const mappedCreatedAt = convertDate(
          String(createdAt),
          new Date().toISOString(),
        );
        const mappedDueDate = dueDate
          ? convertDate(String(dueDate), new Date().toISOString())
          : undefined;

        const issueOptions: CreateIssueOptions = {
          description,
          assigneeIds: assignees,
          confidential,
          epicId: isEpicScoped ? epicId : undefined,
          labels,
          createdAt: mappedCreatedAt,
          dueDate: mappedDueDate,
          discussionToResolve,
          issueType,
          mergeRequestToResolveDiscussionsOf,
          milestoneId,
          weight,
        };

        const response = await ctx.checkpoint({
          key: `issue.${projectId}.${title}`,
          fn: async () => {
            const issue = (await api.Issues.create(
              projectId,
              title,
              issueOptions,
            )) as IssueSchema;

            return {
              id: issue.id,
              web_url: issue.web_url,
              iid: issue.iid,
            };
          },
        });

        ctx.output('issueId', response.id);
        ctx.output('issueUrl', response.web_url);
        ctx.output('issueIid', response.iid);
      } catch (error: any) {
        // Handling other errors
        throw new InputError(
          `Failed to create GitLab issue: ${getErrorMessage(error)}`,
        );
      }
    },
  });
};
