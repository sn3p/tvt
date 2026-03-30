module Species
  class GridSnapshot
    METRICS = %w[presence avg sum].freeze
    EARTH_RADIUS_M = 6_378_137.0
    MAX_LATITUDE = 85.05112878

    def initialize(area_slug:, year:, bird_id:, metric:, cell_size_m:, min_n:, pc4: nil, include_private: nil, include_isorg: nil, bbox: nil)
      @entry_scope = EntryScope.new(
        area_slug: area_slug,
        year: year,
        pc4: pc4,
        include_private: include_private,
        include_isorg: include_isorg,
        scope: "viewport",
        bbox: bbox,
      )
      @area = entry_scope.area
      @year = Integer(year)
      @bird_id = Integer(bird_id)
      @metric = normalize_metric(metric)
      @cell_size_m = Integer(cell_size_m)
      @min_n = Integer(min_n)
      validate!
    end

    def as_json(*)
      {
        area: serialized_area,
        year: year,
        bird_id: bird_id,
        metric: metric,
        cell_size_m: cell_size_m,
        min_n: min_n,
        filters: {
          pc4: entry_scope.pc4,
          include_private: entry_scope.include_private,
          include_isorg: entry_scope.include_isorg,
          bbox: serialized_bbox,
        },
        summary: summary,
        cells: cells,
      }
    end

    private

    attr_reader :area, :bird_id, :cell_size_m, :entry_scope, :metric, :min_n, :year

    def entries
      @entries ||= entry_scope.relation.includes(entry_bird_counts: :bird).to_a
    end

    def cells
      @cells ||= begin
        grouped.values.filter_map do |cell|
          next if cell[:entry_count] < min_n

          value = metric_value(cell)
          next unless value.positive?

          cell.merge(value: value)
        end.sort_by { |cell| [cell[:iy], cell[:ix]] }
      end
    end

    def grouped
      @grouped ||= begin
        grouped = Hash.new { |hash, key| hash[key] = { ix: key[0], iy: key[1], entry_count: 0, with_count: 0, sum_count: 0 } }

        entries.each do |entry|
          ix, iy = project_to_cell(entry)
          cell = grouped[[ix, iy]]
          cell[:entry_count] += 1

          count = count_for_entry(entry)
          next unless count.positive?

          cell[:with_count] += 1
          cell[:sum_count] += count
        end

        grouped
      end
    end

    def summary
      @summary ||= begin
        entry_count = entries.length
        with_count = grouped.values.sum { |cell| cell[:with_count].to_i }
        sum_count = grouped.values.sum { |cell| cell[:sum_count].to_i }
        {
          entry_count: entry_count,
          with_count: with_count,
          sum_count: sum_count,
          avg_count: entry_count.positive? ? (sum_count.to_f / entry_count) : 0.0,
        }
      end
    end

    def count_for_entry(entry)
      row = entry.entry_bird_counts.find { |count_row| count_row.bird.external_id == bird_id }
      row ? row.count.to_i : 0
    end

    def metric_value(cell)
      entry_count = cell[:entry_count].to_i
      return 0.0 if entry_count <= 0

      case metric
      when "sum"
        cell[:sum_count].to_f
      when "avg"
        cell[:sum_count].to_f / entry_count
      else
        cell[:with_count].to_f / entry_count
      end
    end

    def project_to_cell(entry)
      x, y = project_lng_lat(entry.lng.to_f, entry.lat.to_f)
      [(x / cell_size_m).floor, (y / cell_size_m).floor]
    end

    def project_lng_lat(lng, lat)
      lat_clamped = [[lat, -MAX_LATITUDE].max, MAX_LATITUDE].min
      lat_rad = lat_clamped * Math::PI / 180.0
      lng_rad = lng * Math::PI / 180.0
      x = EARTH_RADIUS_M * lng_rad
      y = EARTH_RADIUS_M * Math.log(Math.tan(Math::PI / 4.0 + lat_rad / 2.0))
      [x, y]
    end

    def normalize_metric(value)
      normalized = value.to_s.strip
      raise ArgumentError, "invalid metric" unless METRICS.include?(normalized)

      normalized
    end

    def validate!
      raise ArgumentError, "bird_id must be positive" unless bird_id.positive?
      raise ArgumentError, "cell_size_m must be positive" unless cell_size_m.positive?
      raise ArgumentError, "min_n must be non-negative" if min_n.negative?
    end

    def serialized_bbox
      bbox = entry_scope.bbox
      [bbox[:west], bbox[:south], bbox[:east], bbox[:north]]
    end

    def serialized_area
      return nil unless area

      {
        slug: area.slug,
        name: area.name,
        type: area.type,
        code: area.code,
      }
    end
  end
end
