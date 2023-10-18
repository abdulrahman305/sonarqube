/*
 * SonarQube
 * Copyright (C) 2009-2023 SonarSource SA
 * mailto:info AT sonarsource DOT com
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 3 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

import classNames from 'classnames';
import { isSameMinute } from 'date-fns';
import {
  CellComponent,
  ContentCell,
  FlagMessage,
  Link,
  Note,
  Table,
  TableRow,
  TableRowInteractive,
} from 'design-system';
import { sortBy } from 'lodash';
import * as React from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import DateTimeFormatter from '../../../components/intl/DateTimeFormatter';
import { CleanCodeAttributePill } from '../../../components/shared/CleanCodeAttributePill';
import SoftwareImpactPill from '../../../components/shared/SoftwareImpactPill';
import { parseDate } from '../../../helpers/dates';
import { getRulesUrl } from '../../../helpers/urls';
import { ProfileChangelogEvent } from '../types';
import ChangesList from './ChangesList';

interface Props {
  events: ProfileChangelogEvent[];
}

export default function Changelog(props: Props) {
  const intl = useIntl();

  const sortedRows = sortBy(
    props.events,
    // sort events by date, rounded to a minute, recent events first
    (e) => -Number(parseDate(e.date)),
    (e) => e.action,
  );

  const isSameEventDate = (thisEvent: ProfileChangelogEvent, otherEvent?: ProfileChangelogEvent) =>
    otherEvent !== undefined && isSameMinute(parseDate(otherEvent.date), parseDate(thisEvent.date));

  const isSameEventGroup = (thisEvent: ProfileChangelogEvent, otherEvent?: ProfileChangelogEvent) =>
    otherEvent !== undefined &&
    isSameEventDate(thisEvent, otherEvent) &&
    otherEvent.authorName === thisEvent.authorName &&
    otherEvent.action === thisEvent.action;

  const rows = sortedRows.map((event, index) => {
    const prev = sortedRows[index - 1];
    const isBulkChange = isSameEventGroup(event, prev);

    const nextEventInDifferentGroup = sortedRows
      .slice(index + 1)
      .find((e) => !isSameEventGroup(event, e));

    const isNewSonarQubeVersion =
      !isBulkChange &&
      nextEventInDifferentGroup !== undefined &&
      nextEventInDifferentGroup.sonarQubeVersion !== event.sonarQubeVersion;

    return (
      <TableRowInteractive key={index}>
        <ContentCell
          className={classNames('sw-align-top', { 'sw-border-transparent': isBulkChange })}
        >
          {!isBulkChange && (
            <div>
              <span className="sw-whitespace-nowrap">
                <DateTimeFormatter date={event.date} />
              </span>

              {isNewSonarQubeVersion && (
                <div className="sw-mt-2 sw-whitespace-nowrap">
                  <FlagMessage variant="info">
                    <FormattedMessage
                      id="quality_profiles.changelog.sq_upgrade"
                      values={{
                        sqVersion: event.sonarQubeVersion,
                      }}
                    />
                  </FlagMessage>
                </div>
              )}
            </div>
          )}
        </ContentCell>

        <ContentCell
          className={classNames('sw-whitespace-nowrap sw-align-top sw-max-w-[120px]', {
            'sw-border-transparent': isBulkChange,
          })}
        >
          {!isBulkChange && (event.authorName ? event.authorName : <Note>System</Note>)}
        </ContentCell>

        <ContentCell
          className={classNames('sw-whitespace-nowrap sw-align-top', {
            'sw-border-transparent': isBulkChange,
          })}
        >
          {!isBulkChange &&
            intl.formatMessage({ id: `quality_profiles.changelog.${event.action}` })}
        </ContentCell>

        <CellComponent
          className={classNames('sw-align-top', { 'sw-border-transparent': isBulkChange })}
        >
          {event.ruleName && (
            <Link to={getRulesUrl({ rule_key: event.ruleKey })}>{event.ruleName}</Link>
          )}
          <div className="sw-mt-3 sw-flex sw-gap-2">
            {event.cleanCodeAttributeCategory && (
              <CleanCodeAttributePill
                cleanCodeAttributeCategory={event.cleanCodeAttributeCategory}
              />
            )}
            {event.impacts?.map((impact) => (
              <SoftwareImpactPill
                key={impact.softwareQuality}
                quality={impact.softwareQuality}
                severity={impact.severity}
              />
            ))}
          </div>
        </CellComponent>

        <ContentCell
          className={classNames('sw-align-top sw-max-w-[400px]', {
            'sw-border-transparent': isBulkChange,
          })}
        >
          {event.params && <ChangesList changes={event.params} />}
        </ContentCell>
      </TableRowInteractive>
    );
  });

  return (
    <Table
      columnCount={5}
      columnWidths={['1%', '1%', '1%', 'auto', 'auto']}
      header={
        <TableRow>
          <ContentCell>{intl.formatMessage({ id: 'date' })}</ContentCell>
          <ContentCell>{intl.formatMessage({ id: 'user' })}</ContentCell>
          <ContentCell>{intl.formatMessage({ id: 'action' })}</ContentCell>
          <ContentCell>{intl.formatMessage({ id: 'rule' })}</ContentCell>
          <ContentCell>{intl.formatMessage({ id: 'updates' })}</ContentCell>
        </TableRow>
      }
    >
      {rows}
    </Table>
  );
}
