var SyncAssistant = new Cobra.Class({
    __init__: function(self) {
        self.client = new MeetupApiClient('5d94f505664713d6b7d677773702163');
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

        self.controller.setupWidget('sync-button', {}, self.buttonModel);

        Mojo.Event.listen($('sync-button'), Mojo.Event.tap, function() {
            self.buttonModel.disabled = true;
            self.controller.modelChanged(self.buttonModel)
            self.syncCalendar();
        });

        // A little continuation passing style ;)
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
            onError: function(error) {
                Mojo.Log.error("Fetching accounts failed: %j", error);
                window.close();
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
                        onError: function(error) {
                            Mojo.Log.error("Creating calendar failed: %j", error);
                            window.close();
                        }
                    });
                }
            },
            onError: function(error) {
                Mojo.Log.error("Fetching calendars failed: %j", error);
                window.close();
            }
        });
    },

    /* Syncs every upcoming meetup within 100 miles of San Francico */
    syncCalendar: function(self) {
        self.client.get_events({
            zip: 94107,
            radius: 100,
            after: "02042009"
        }, self._saveEvents);
    },

    _saveEvents: function(self, events) {
        self._syncStatus = {
            events: events,
            numReturned: 0,
            started: new Date().getTime(),
            failures: 0
        };

        events.results.each(function(meetupEvent) {
            var time = new Date(meetupEvent.time).getTime();
            self.controller.serviceRequest(self.calendarServiceId, {
                method: 'createEvent',
                parameters: {
                    calendarId: self.calendar.calendarId,
                    event: {
                        eventId: meetupEvent.id,
                        subject: meetupEvent.name,
                        startTimestamp: time,
                        endTimestamp: time + 3600000, //1 hour in ms
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
        });
    },

    _createdEvent: function(self, response) {
        self._checkIfSyncFinished();
    },

    _errorCreatingEvent: function(self, response) {
        Mojo.Log.error("Could not create event: %j", response);
        self._syncStatus.failures++;
        self._checkIfSyncFinished();
    },

    _failureCreatingEvent: function(self, response) {
        Mojo.Log.error("Failed to create event: %d, %j", self._eventsReturned, response);
        self._syncStatus.failures++;
        self._checkIfSyncFinished();
    },

    _checkIfSyncFinished: function(self) {
        with (self._syncStatus) {
            numReturned++;
            if (numReturned == events.meta.count) {
                var now = new Date().getTime();
                var records = events.meta.count - failures;
                var seconds = (now - started)/1000;

                self._syncStats.push({
                    records: records,
                    seconds: seconds
                });

                var logString = ["Created", records, "records in ", seconds, 
                    "seconds (", records/seconds, "records/second)"].join(' ');
                Mojo.Log.info(logString);
                $('output').appendChild(new Element('div', {'class': 'log'}).update(logString));

                if (events.meta.next) {
                    Mojo.Log.info("Fetching the next page of results...");
                    self.client.nextPage(self._saveEvents);
                }
                else {
                    Mojo.Log.info("Fetched all the results, accumulating final stats...");
                    var finalStats = self._syncStats.inject(
                        {records:0, seconds:0},
                        function(acc, n) {
                            acc.records += n.records;
                            acc.seconds += n.seconds;
                            return acc;
                        }
                    );
                    var logString = ["Total Created:", finalStats.records , "records in ", finalStats.seconds, 
                        "seconds (Averaged", finalStats.records/finalStats.seconds, "records/second)"].join(' ');
                    Mojo.Log.info(logString);
                    $('output').appendChild(new Element('div', {'class': 'log'}).update(logString));
                }
            }
        }
    },

    _formatNote: function(self, mtEvent) {
        return [
            mtEvent.fee, mtEvent.feecurrency, "\n", mtEvent.event_url
        ].join(' ');
    }
});
