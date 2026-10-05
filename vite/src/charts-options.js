export function severityChartOptions(data) {
  return {
    chart: {
        type: 'pie',
        height: '20%'
    },
    series: data,
    labels: ['Fatal', 'Serious', 'Slight'],
    plotOptions: {
      pie: {
        expandOnClick: false
      }
    },
    colors: ['#ca283b', '#cb852b', '#cac426'],
    legend: {
      fontFamily: 'Inter',
      fontSize: '16px',
      markers: {
        offsetX: -10
      }
    },
    dataLabels: {
        textAnchor: 'middle',
        style: {
            fontFamily: 'Inter',
            colors: ['#373d3f']
        },
        dropShadow:{
          enabled: false
        }
    },
    tooltip:{
          style:{
            fontFamily: 'Inter'
          }
        },
  };
}

export function casualtyChartOptions(data) {
    return {
        chart: { 
            type: 'bar',
            height: '28%',
            toolbar: {
            show: false  // disables all toolbar buttons
            }
        },
        series: [{
            name: 'Number of Accidents',
            data: data
        }],
        yaxis: {
          logarithmic: false,
          labels:{
            style:{
              fontFamily: 'Inter'
            }
          },
        },
        xaxis: {
          labels:{
            style:{
              fontFamily: 'Inter'
            }
          }
        },
        dataLabels:{
          style:{
            fontFamily: 'Inter',
            colors: ['#373d3f']
          }
        },
        tooltip:{
          style:{
            fontFamily: 'Inter'
          }
        }
    };
}

export function weekdaysChartOptions(data) {
    return {
        chart: { 
            type: 'area',
            height: '28%',
            toolbar: {
            show: false  // disables all toolbar buttons
            }
        },
        series: [{
            name: 'Number of Accidents',
            data: data
        }],
        yaxis: {
          labels:{
            style:{
              fontFamily: 'Inter'
            }
          }
        },
        xaxis: {
          labels:{
            style:{
              fontFamily: 'Inter'
            }
          },
          tooltip:{
            enabled: false
          }
        },
        dataLabels:{
          enabled: false
        },
        tooltip:{
          style:{
            fontFamily: 'Inter'
          }
        },
        stroke:{
          width: 2
        },
        colors:['#73c421']
    };
}