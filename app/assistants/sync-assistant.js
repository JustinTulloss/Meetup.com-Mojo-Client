/*
 * Copyright (C) 2009 Justin Tulloss
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA
 */

var SyncAssistant = new Cobra.Class({
    __init__: function(self) {
        self.client = new MeetupApiClient(Meet.Auth.apiKey);
        self.calendarServiceId = "palm://com.palm.calendar/crud/";
        self.accountServiceId = "palm://com.palm.accounts/crud/";
        self._syncStats = [];
    },

    setup: function(self) {
        // Initialize scene elements.
        self.buttonModel = {
            buttonLabel: 'Sync',
            disabled: true
        };

        self.controller.setupWidget('sync-button', {
            type: Mojo.Widget.activityButton
        }, self.buttonModel);

        Mojo.Event.listen($('sync-button'), Mojo.Event.tap, function() {
            self.buttonModel.disabled = true;
            self.controller.modelChanged(self.buttonModel)
            self.controller.get("sync-button").mojo.activate();
            self.syncCalendar();
        });

        self.setupAccount(function() {
            self.setupCalendar(function() {
                self.buttonModel.disabled = false;
                self.controller.modelChanged(self.buttonModel)
            });
        });
    },

    /* Retrieves account if it exists, otherwise creates it */
    setupAccount: function(self, k) {
        self.controller.serviceRequest(self.accountServiceId, {
            method: 'listAccounts',
            parameters: {},
            onSuccess: function(list) {
                Mojo.Log.info("Got account list: %j", list);
                if (list.list && list.list.length > 0) {
                    self.account = list.list[0];
                    k();
                }
                else {
                    self.account = {
                        username: "justin",
                        domain: "meetup.com",
                        displayName: "Meetup.com",
                        dataTypes: ["CALENDAR"],
                        isDataReadOnly: true,
                        icons: {largeIcon: '', smallIcon: ''}
                    };
                    self.controller.serviceRequest(self.accountServiceId, {
                        method: 'createAccount',
                        parameters: self.account,
                        onSuccess: function(response) {
                            Mojo.Log.info("Got %j for %j", response, self.account);
                            self.account.accountId = response.accountId;
                            k();
                        }
                    });
                }
            },
            onFailure: function() {
                Mojo.Controller.errorDialog("Failed to create account");
            },
            onError: function(error) {
                Mojo.Controller.errorDialog("Error creating account");
            }
        })
    },

    /* Retrieves calendar if it exists, otherwise creates it */
    setupCalendar: function(self, k) {
        self.controller.serviceRequest(self.calendarServiceId, {
            method: 'listCalendars',
            parameters: {
                accountId: self.account.accountId
            },
            onSuccess: function(calList) {
                Mojo.Log.info("Got calendar list");
                if (calList.calendars.length > 0) {
                    self.calendar = calList.calendars[0];
                    k();
                }
                else {
                    self.calendar = {
                        name: "Meetup.com"
                    }
                    self.controller.serviceRequest(self.calendarServiceId, {
                        method: 'createCalendar',
                        parameters: {
                            accountId: self.account.accountId,
                            calendar: self.calendar
                        },
                        onSuccess: function(response) {
                            self.calendar.calendarId = response.calendarId
                            k();
                        },
                        onFailure: function(error) {
                            Mojo.Log.error("Creating calendar failed: %j", error);
                            Mojo.Controller.errorDialog("Failed to create calendar");
                        },
                        onError: function(error) {
                            Mojo.Log.error("Creating calendar failed: %j", error);
                            Mojo.Controller.errorDialog("Error creating calendar");
                        }
                    });
                }
            },
            onFailure: function() {
                Mojo.Controller.errorDialog("Failed to create calendar");
            },
            onError: function(error) {
                Mojo.Controller.errorDialog("Error creating calendar");
            }
        });
    },

    syncCalendar: function(self) {
        // Gets my member id
        Mojo.Log.info("Syncing calendar");
        self.client.get_members({
            relation: "self"
        }, self._getGroups);
    },

    _getGroups: function(self, members) {
        Mojo.Log.info("Got members");
        var memberId = members.results[0].id;
        self.client.get_groups({
            member_id: memberId
        }, self._getEvents);
    },

    _getEvents: function(self, groups) {
        Mojo.Log.info("Got events");
        groups = groups.results;
        var groupString = groups[0].id;
        var today = new Date();
        for (var i = 1; i < groups.length; i++) {
            groupString += "," + groups[i].id;
        }
        self.client.get_events({
            group_id: groupString,
            after: today.getMonth() + today.getDay() + today.getFullYear()
        }, self._saveEvents);
    },

    _saveEvents: function(self, events) {
        Mojo.Log.info("Saving events");

        self.numEventsProcessed = 0;
        self.events = events;

        events.results.each(function(meetupEvent) {
            var time = new Date(meetupEvent.time).getTime();
            if (meetupEvent.myrsvp != "no") {
                self.controller.serviceRequest(self.calendarServiceId, {
                    method: 'createEvent',
                    parameters: {
                        calendarId: self.calendar.calendarId,
                        event: {
                            eventId: meetupEvent.id,
                            subject: meetupEvent.name,
                            startTimestamp: time,
                            endTimestamp: time + 3600000, // 1 hour in ms
                            allDay: false,
                            note: self._formatNote(meetupEvent),
                            location: meetupEvent.lat + ", " + meetupEvent.lon,
                            alarm: 'none',
                        }
                    },
                    onSuccess: self._createdEvent,
                    onError: self._errorCreatingEvent,
                    onFailure: self._failureCreatingEvent
                });
            }
        });
    },

    _createdEvent: function(self, response) {
        self._checkIfSyncFinished();
    },

    _errorCreatingEvent: function(self, response) {
        Mojo.Log.error("Could not create event: %j", response);
        self._checkIfSyncFinished();
    },

    _failureCreatingEvent: function(self, response) {
        Mojo.Log.error("Failed to create event: %d, %j", self._eventsReturned, response);
        self._checkIfSyncFinished();
    },

    _checkIfSyncFinished: function(self) {
        self.numEventsProcessed++;
        if (self.numEventsProcessed == self.events.meta.count) {

            if (self.events.meta.next) {
                Mojo.Log.info("Fetching the next page of results...");
                self.client.nextPage(self._saveEvents);
            }
            else {
                Mojo.Log.info("Fetched all the events");
                self.buttonModel.disabled = false;
                self.controller.modelChanged(self.buttonModel);
                self.controller.get("sync-button").mojo.deactivate();
            }
        }
    },

    _formatNote: function(self, mtEvent) {
        return [
            mtEvent.fee, mtEvent.feecurrency, "\n", mtEvent.event_url
        ].join(' ');
    }
});
