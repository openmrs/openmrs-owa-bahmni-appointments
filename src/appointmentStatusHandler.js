window.Bahmni = window.Bahmni || {};
Bahmni.Appointments = Bahmni.Appointments || {};

Bahmni.Appointments.AppointmentStatusHandler = (function () {
    const mapNewProvidersToGivenResponse = function (appointment, existingProvidersUuids, response) {
        return _.map(appointment.providers, function (provider) {
            if (_.includes(existingProvidersUuids, provider.uuid)) {
                return {uuid: provider.uuid, response: provider.response};
            } else {
                return {uuid: provider.uuid, response: response};
            }
        });
    };

    const appointmentStatuses = function () {
        return Bahmni.Appointments.Constants.appointmentStatuses;
    };

    const providerResponses = function () {
        return Bahmni.Appointments.Constants.providerResponses;
    };

    const isStatusRequested = function (status) {
        return status === appointmentStatuses().Requested;
    };

    const isStatusScheduled = function (status) {
        return status === appointmentStatuses().Scheduled;
    };

    const isNewAppointment = function (appointment) {
        return !appointment.uuid;
    };

    const getStatusForAppointment = function (appointment) {
        if (isNewAppointment(appointment) || isStatusRequested(appointment.status)) {
            return appointmentStatuses().Scheduled;
        } else {
            return appointment.status;
        }
    };

    const updateIfCurrentProviderInAppointment = function (statusAndProviderResponse, currentProviderUuid, appointment) {
        const currentProviderInAppointment = _.find(statusAndProviderResponse.providers, provider => provider.uuid === currentProviderUuid);
        if (!currentProviderInAppointment) return;

        currentProviderInAppointment.response = providerResponses().ACCEPTED;
        statusAndProviderResponse.status = getStatusForAppointment(appointment);
    };

    const handleRescheduledAppointment = function (statusAndProviderResponse, appointment, currentProviderUuid) {
        //this is an special edit
        // in this case we don't keep the existing appointment status and responses
        statusAndProviderResponse.status = appointmentStatuses().Requested;
        statusAndProviderResponse.providers = _.map(appointment.providers, function (provider) {
            return {uuid: provider.uuid, response: providerResponses().AWAITING}
        });

        const currentProviderInAppointment = _.find(statusAndProviderResponse.providers, provider => provider.uuid === currentProviderUuid);
        if (currentProviderInAppointment) {
            statusAndProviderResponse.status = appointmentStatuses().Scheduled;
            currentProviderInAppointment.response = providerResponses().ACCEPTED;
        }
    };

    const updateIfAtleastOneProviderHasAccepted = function (statusAndProviderResponse) {
        //this handles special cases like,
        //  when new providers are added to a no provider appointment
        //  when only accepted provider is removed from appointment appointment
        const hasAtleastOneAccept = _.some(statusAndProviderResponse.providers, function (provider) {
            return provider.response === providerResponses().ACCEPTED;
        });
        if (hasAtleastOneAccept) {
            if (isStatusRequested(statusAndProviderResponse.status)) {
                statusAndProviderResponse.status = appointmentStatuses().Scheduled;
            }
        } else {
            if (isStatusScheduled(statusAndProviderResponse.status)) {
                statusAndProviderResponse.status = appointmentStatuses().Requested;
            }
        }
    };

    const statusAndResponseForZeroProviders = function (appointment) {
        const statusAndProviderResponse = {providers: []};
        if (isNewAppointment(appointment) || isStatusRequested(appointment.status)) {
            statusAndProviderResponse.status = appointmentStatuses().Scheduled;
        } else {
            statusAndProviderResponse.status = appointment.status;
        }
        return statusAndProviderResponse;
    };


    const statusAndResponseForScheduledServices = function (appointment) {
        const statusAndProviderResponse = {};
        statusAndProviderResponse.status = isNewAppointment(appointment) ?
            appointmentStatuses().Scheduled : appointment.status;
        statusAndProviderResponse.providers = _.map(appointment.providers, function (provider) {
            return {uuid: provider.uuid, response: providerResponses().ACCEPTED};
        });
        return statusAndProviderResponse;
    };

    const statusAndResponseForRequestedServices = function (appointment, existingProvidersUuids) {
        const statusAndProviderResponse = {};
        statusAndProviderResponse.status = isNewAppointment(appointment) ?
            appointmentStatuses().Requested : appointment.status;

        statusAndProviderResponse.providers = mapNewProvidersToGivenResponse(appointment, existingProvidersUuids,
            providerResponses().AWAITING);
        return statusAndProviderResponse;
    };

    const getUpdatedStatusAndProviderResponse = function (appointment, currentProviderUuid, existingProvidersUuids, isRescheduled) {
        if (!isStatusRequested(appointment.service.initialAppointmentStatus)) {
            return statusAndResponseForScheduledServices(appointment);
        }
        if (_.isEmpty(appointment.providers)) {
            return {status: getStatusForAppointment(appointment), providers:[]};
        }
        const statusAndProviderResponse = statusAndResponseForRequestedServices(appointment, existingProvidersUuids);

        updateIfCurrentProviderInAppointment(statusAndProviderResponse, currentProviderUuid, appointment);
        updateIfAtleastOneProviderHasAccepted(statusAndProviderResponse);

        if (isRescheduled) {
            handleRescheduledAppointment(statusAndProviderResponse, appointment, currentProviderUuid);
        }
        return statusAndProviderResponse;
    };

    return {
        getUpdatedStatusAndProviderResponse: getUpdatedStatusAndProviderResponse,
    }
})();