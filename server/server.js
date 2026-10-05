import 'dotenv/config';
import express from 'express';
import { Pool } from 'pg';
import cors from 'cors';
import * as turf from '@turf/turf';
import RBush from 'rbush';
import multer from 'multer';
import { parse } from 'csv-parse/sync';

const upload = multer({ storage: multer.memoryStorage() });

let currentData;

const app = express();
app.use(cors());

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

app.post('/accidents/bulk', upload.single('file'), async (req, res) => {
  const records = parse(req.file.buffer.toString('utf8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  let csvColumns = Object.keys(records[0]);
  csvColumns = csvColumns.filter((name) => name !== 'accident_index');

  const maxResult = await pool.query(`
    SELECT COALESCE(MAX(CAST(accident_index AS INTEGER)), 0) AS max_idx
    FROM accidents
    WHERE accident_index ~ '^[0-9]+$'
  `);
  let maxIdx = maxResult.rows[0].max_idx || 0;

  const rowsParamCount = 1 + csvColumns.length;
  const values = [];
  const placeholders = [];

  records.forEach((row, rowIndex) => {
    const newAccidentIndex = (maxIdx + rowIndex + 1).toString();

    values.push(newAccidentIndex);
    csvColumns.forEach((colName) => {
      values.push(row[colName]);
    });

    const base = rowIndex * rowsParamCount;
    const firstParamNo = base + 1;

    const rowPlaceholders = [];
    for (let i = 0; i < rowsParamCount; i++) {
      rowPlaceholders.push(`$${firstParamNo + i}`);
    }

    placeholders.push(`(${rowPlaceholders.join(',')})`);
  });

  const insertColumnsSQL = ['accident_index', ...csvColumns].join(',');

  const insertQuery = `
    INSERT INTO accidents (${insertColumnsSQL})
    VALUES
      ${placeholders.join(',\n')}
    RETURNING *;
  `;

  try {
    const result = await pool.query(insertQuery, values);
    currentData = currentData.concat(result.rows);
    res.status(201).json({insertedCount: result.rowCount, rows: result.rows});
  } catch (err) {
    console.error('Bulk import error:', err);
    res.status(500).json({ error: err.message || 'Database Bulk Insert error' });
  }
});

app.use(express.json());

app.get('/accidents', async (req, res) => {
  const filters = [];
  const allowedFilters = {
    severity: 'accident_severity',
    weather: 'weather_conditions',
    weekday: 'day_of_week'
  };
  
  for (const key in allowedFilters) {
    if (req.query[key]) {
      const values = Array.isArray(req.query[key]) ? req.query[key] : [req.query[key]];

      if(key == 'weather'){
        const likes = values.map(v => `${allowedFilters[key]} LIKE '%${v}%'`);
        filters.push(`(${likes.join(' OR ')})`);
      } else {
        filters.push(`${allowedFilters[key]} IN (${values.map(v => `'${v}'`).join(', ')})`);
      }
    }
  }

  let query = "SELECT * FROM accidents WHERE 1=1";

  if (filters.length > 0) {
    query += " AND " + filters.join(' AND ');
  }

  //query += ' ORDER BY accident_index';
  query += ` AND accident_date >= '2021-01-02' AND accident_date < '2021-01-16'` // for 4 weeks, use day 30
  console.log(query);

  try {
    const result = await pool.query(query);
    currentData = result.rows;
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/accidents', async (req, res) => {
  const {
    latitude,
    longitude,
    accident_severity,
    weather_conditions,
    accident_date,
    day_of_week
  } = req.body;

  let query = `INSERT INTO accidents 
              (accident_index,latitude,longitude,accident_severity,weather_conditions,accident_date,day_of_week) 
              VALUES (
              (
                SELECT (COALESCE(MAX(CAST(accident_index AS INTEGER)), 0) + 1)::TEXT
                FROM accidents
                WHERE accident_index ~ '^[0-9]+$'
              ),
              $1, $2, $3, $4, $5, $6)
              RETURNING *`;
  
  const params = [
    latitude,
    longitude,
    accident_severity,
    weather_conditions,
    accident_date,
    day_of_week
  ]
  
  try {
    const result = await pool.query(query, params);
    const inserted = result.rows[0];
    currentData.push(inserted);
    res.status(201).json(inserted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Database Insert error' });
  }
});

app.put('/accidents/:id', async (req, res) => {
  const accident_index = req.params.id;
  const {
    latitude,
    longitude,
    accident_severity,
    weather_conditions,
    accident_date,
  } = req.body;

  let query = `UPDATE accidents 
              SET
                latitude = $1,
                longitude = $2,
                accident_severity = $3,
                weather_conditions = $4,
                accident_date = $5
              WHERE accident_index = $6
              RETURNING *`;
  
  const params = [
    latitude,
    longitude,
    accident_severity,
    weather_conditions,
    accident_date,
    accident_index
  ]
  
  try {
    const result = await pool.query(query, params);
    const updated = result.rows[0];
    const idx = currentData.findIndex(a => a.accident_index === updated.accident_index);
    currentData[idx] = updated;
    res.status(200).json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Database Update error' });
  }
});

app.delete('/accidents/:id', async (req, res) => {
  const accident_index = req.params.id;

  let query = `DELETE FROM accidents 
              WHERE accident_index = $1
              RETURNING *`;

  const params = [accident_index]
  
  try {
    const result = await pool.query(query, params);
    const deleted = result.rows[0];
    currentData = currentData.filter(a => a.accident_index !== deleted.accident_index)
    res.status(200).json(deleted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Database Delete error' });
  }
});

app.get('/districts', async (req, res) => {
  try {
    const query = `
      SELECT json_build_object(
        'type', 'FeatureCollection',
        'features', json_agg(
          json_build_object(
            'type', 'Feature',
            'geometry', ST_AsGeoJSON(geom)::json,
            'properties', json_build_object(
              'lad22cd', "lad22cd",
              'lad22nm', "lad22nm"
            )
          )
        )
      ) AS geojson
      FROM districts;
    `;
    const { rows } = await pool.query(query);
    var districts = rows[0].geojson;

    districts.features.forEach(feature => feature.properties.accident_count = 0);
    
    const index = new RBush();
    districts.features.forEach((feature, i) => {
      const bbox = turf.bbox(feature);
      index.insert({
        minX: bbox[0],
        minY: bbox[1],
        maxX: bbox[2],
        maxY: bbox[3],
        i
      });
    });

    currentData.forEach(accident => {
      const pt = turf.point([accident.longitude, accident.latitude]);
      const candidates = index.search({
        minX: accident.longitude,
        minY: accident.latitude,
        maxX: accident.longitude,
        maxY: accident.latitude
      });

      candidates.forEach(c => {
        const feature = districts.features[c.i];
        if (turf.booleanPointInPolygon(pt, feature)) {
          feature.properties.accident_count++;
        }
      });
    });

    res.json(districts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
