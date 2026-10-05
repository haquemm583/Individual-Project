const spotsDropdown = document.querySelector('#spotsDropdown');
const spotsStatus = document.querySelector('#spot-status');
const conditionsStatus = document.querySelector('#conditions-status');
const forecastSlider = document.querySelector('#forecast-hour');
const refreshWeather = document.querySelector('#refresh-weather');

let selectedFishingSpot = null;
let spots = [];
let rigs = [];
let forecast = [];
let weatherRequest = null;

async function loadFishingSpots() {
    spotsDropdown.disabled = true;
    spotsStatus.textContent = 'Loading fishing spots…';
    document.querySelector('#retry-spots').hidden = true;
    try {
        const spotsRequest = await fetch('data/spots.json');
        if (!spotsRequest.ok) throw new Error('Could not load fishing spots');
        const spotsData = await spotsRequest.json();
        spots = spotsData.spots;
        rigs = spotsData.rigs;
        if (!spots.length) throw new Error('No fishing spots found');
        spotsDropdown.textContent = '';
        spots.forEach(spot => {
            const option = document.createElement('option');
            option.value = spot.id;
            option.textContent = spot.name;
            spotsDropdown.append(option);
        });
        try {
            const savedSpot = localStorage.getItem('fishingSpot');
            if (spots.some(spot => spot.id === savedSpot)) spotsDropdown.value = savedSpot;
        } catch (error) {
            console.warn('Saved preferences are unavailable', error);
        }
        spotsDropdown.disabled = false;
        showFishingSpot();
    } catch (error) {
        spotsStatus.textContent = 'Failed to load fishing spots. Try again.';
        document.querySelector('#retry-spots').hidden = false;
        console.error(error);
    }
}

function showFishingSpot() {
    selectedFishingSpot = spots.find(spot => spot.id === spotsDropdown.value);
    if (!selectedFishingSpot) return;
    spotsStatus.textContent = `Selected fishing spot: ${selectedFishingSpot.name}`;
    try {
        localStorage.setItem('fishingSpot', selectedFishingSpot.id);
    } catch (error) {
        spotsStatus.textContent += '. Your browser could not save this selection.';
    }
    document.querySelector('#spot-description').textContent = selectedFishingSpot.description;
    document.querySelector('#water-body').textContent = selectedFishingSpot.waterBody;
    document.querySelector('#fishing-methods').textContent = selectedFishingSpot.fishingMethods.join(', ');
    const accessLink = document.querySelector('#access-link');
    accessLink.href = selectedFishingSpot.access.visitorInfoUrl;
    accessLink.textContent = `Visitor information for ${selectedFishingSpot.name}`;

    const tipsList = document.querySelector('#fishing-tips');
    tipsList.textContent = '';
    selectedFishingSpot.tips.forEach(tip => {
        const listItem = document.createElement('li');
        listItem.textContent = tip;
        tipsList.append(listItem);
    });

    const rigsList = document.querySelector('#suggested-rigs');
    rigsList.textContent = '';
    const suggestedRigs = rigs.filter(rig => {
        return selectedFishingSpot.suggestedRigIds.includes(rig.id);
    });
    suggestedRigs.forEach(rig => {
        const rigItem = document.createElement('details');
        const rigName = document.createElement('summary');
        rigName.textContent = rig.name;
        const descriptionItem = document.createElement('p');
        descriptionItem.textContent = `${rig.description} ${rig.useWhen}`;
        const diagram = document.createElement('img');
        diagram.src = `images/${rig.id}.svg`;
        diagram.alt = `${rig.name} schematic. Components: ${rig.components.join(', ')}.`;
        diagram.width = 360;
        diagram.height = 220;
        const components = document.createElement('p');
        components.textContent = `You need: ${rig.components.join(', ')}.`;
        rigItem.append(rigName, descriptionItem, diagram, components);
        rigsList.append(rigItem);
    });
    loadWeather();
}

async function loadWeather() {
    if (!selectedFishingSpot) return;
    if (weatherRequest) weatherRequest.abort();
    const request = new AbortController();
    weatherRequest = request;
    const timeout = setTimeout(() => request.abort(), 15000);
    forecast = [];
    forecastSlider.disabled = true;
    forecastSlider.value = 0;
    refreshWeather.disabled = true;
    document.querySelector('#forecast-label').textContent = 'Waiting for weather';
    document.querySelector('#wind-meter').hidden = true;
    ['#temperature', '#wind', '#weather-description', '#feels-like'].forEach(selector => {
        document.querySelector(selector).textContent = '—';
    });
    document.querySelector('#recommendations-status').textContent = 'Loading weather-based suggestions…';
    document.querySelector('#timing-tip').textContent = '';
    conditionsStatus.textContent = 'Loading weather…';
    try {
        const fields = 'temperature_2m,apparent_temperature,wind_speed_10m,weather_code,is_day';
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${selectedFishingSpot.latitude}&longitude=${selectedFishingSpot.longitude}&current=${fields}&hourly=${fields}&forecast_hours=13&temperature_unit=fahrenheit&wind_speed_unit=mph&timeformat=unixtime`;
        const response = await fetch(url, { signal: request.signal });
        if (!response.ok) throw new Error(`Weather request failed: ${response.status}`);
        const data = await response.json();
        if (!Number.isFinite(data.current?.time) || !Array.isArray(data.hourly?.time)) throw new Error('Weather data is missing');
        if (weatherRequest !== request) return;
        forecast = [data.current];
        data.hourly.time.forEach((time, index) => {
            if (time <= data.current.time) return;
            const hour = { time };
            fields.split(',').forEach(field => {
                hour[field] = data.hourly[field]?.[index];
            });
            forecast.push(hour);
        });
        forecastSlider.max = forecast.length - 1;
        forecastSlider.disabled = forecast.length < 2;
        showWeather();
        const calmerHours = forecast.slice(1).filter(hour => {
            return hour.is_day === 1 && Number.isFinite(hour.wind_speed_10m) && hour.weather_code >= 0 && hour.weather_code <= 3;
        });
        calmerHours.sort((a, b) => a.wind_speed_10m - b.wind_speed_10m);
        document.querySelector('#timing-tip').textContent = calmerHours.length
            ? `Lowest-wind dry daylight hour in this forecast: ${formatTime(calmerHours[0].time)} (${Math.round(calmerHours[0].wind_speed_10m)} mph). Compare hours before choosing when to go.`
            : 'No dry daylight hour was found in this short forecast. Check a later forecast when planning your trip.';
    } catch (error) {
        if (weatherRequest !== request) return;
        conditionsStatus.textContent = 'Weather is unavailable. Try Refresh weather.';
        document.querySelector('#forecast-label').textContent = 'Forecast unavailable';
        document.querySelector('#recommendations-status').textContent = 'Weather suggestions are unavailable. General spot tips are shown below.';
        console.error(error);
    } finally {
        clearTimeout(timeout);
        if (weatherRequest === request) refreshWeather.disabled = false;
    }
}

function formatTime(time) {
    return new Date(time * 1000).toLocaleString('en-US', {
        timeZone: 'America/Chicago', weekday: 'short', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
    });
}

function weatherDescription(code) {
    if (!Number.isFinite(code)) return 'Unavailable';
    if (code <= 3 && code >= 0) return ['Clear', 'Mostly clear', 'Partly cloudy', 'Overcast'][code];
    if ([45, 48].includes(code)) return 'Fog';
    if ([51, 53, 55].includes(code)) return 'Drizzle';
    if ([56, 57, 66, 67].includes(code)) return 'Freezing precipitation';
    if ([61, 63, 65, 80, 81, 82].includes(code)) return 'Rain';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow';
    if ([95, 96, 97, 99].includes(code)) return 'Thunderstorm';
    return 'Unknown conditions';
}

function showWeather() {
    const hour = forecast[Number(forecastSlider.value)];
    if (!hour) return;
    const label = `${forecastSlider.value === '0' ? 'Current' : 'Forecast'} · ${formatTime(hour.time)}`;
    document.querySelector('#forecast-label').textContent = label;
    forecastSlider.setAttribute('aria-valuetext', label);
    conditionsStatus.textContent = 'Weather loaded. Move the slider to compare hours.';
    document.querySelector('#temperature').textContent = Number.isFinite(hour.temperature_2m) ? `${Math.round(hour.temperature_2m)} °F` : 'Unavailable';
    document.querySelector('#feels-like').textContent = Number.isFinite(hour.apparent_temperature) ? `${Math.round(hour.apparent_temperature)} °F` : 'Unavailable';
    document.querySelector('#wind').textContent = Number.isFinite(hour.wind_speed_10m) ? `${Math.round(hour.wind_speed_10m)} mph` : 'Unavailable';
    document.querySelector('#weather-description').textContent = weatherDescription(hour.weather_code);
    const windMeter = document.querySelector('#wind-meter');
    windMeter.hidden = !Number.isFinite(hour.wind_speed_10m);
    windMeter.value = Number.isFinite(hour.wind_speed_10m) ? hour.wind_speed_10m : 0;
    windMeter.setAttribute('aria-valuetext', `${hour.wind_speed_10m} miles per hour`);

    let tip = 'Compare the rig suggestions below with the type of access at this spot.';
    if (hour.wind_speed_10m >= 15) {
        tip = 'Wind may make casting and float control harder. Compare a calmer hour before fishing exposed water.';
    } else if (Number.isFinite(hour.wind_speed_10m) && hour.wind_speed_10m < 15 && selectedFishingSpot.suggestedRigIds.includes('popping-cork')) {
        tip = 'With lighter wind, consider the suggested popping cork and shrimp setup. Adjust bait depth for the water you are fishing.';
    }
    if ([95, 96, 97, 99].includes(hour.weather_code)) {
        tip = 'Thunderstorms are indicated. Postpone fishing and check local weather alerts.';
    } else if ([56, 57, 66, 67, 71, 73, 75, 77, 85, 86].includes(hour.weather_code)) {
        tip = 'Wintry precipitation is indicated. Consider another time and check local weather alerts.';
    } else if (hour.weather_code >= 51 && hour.weather_code <= 82) {
        tip += ' Rain is indicated; compare a drier hour.';
    } else if ([45, 48].includes(hour.weather_code)) {
        tip += ' Fog may limit visibility.';
    }
    if (hour.apparent_temperature >= 95) tip += ' It may feel hot; consider a cooler hour and bring water.';
    if (hour.is_day === 0) tip += ' This is after dark; check lighting and access hours.';
    document.querySelector('#recommendations-status').textContent = tip;
}

spotsDropdown.addEventListener('change', showFishingSpot);
forecastSlider.addEventListener('input', showWeather);
refreshWeather.addEventListener('click', loadWeather);
document.querySelector('#retry-spots').addEventListener('click', loadFishingSpots);
loadFishingSpots();
