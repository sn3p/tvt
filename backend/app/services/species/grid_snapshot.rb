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

    def filtered_entries_relation
      @filtered_entries_relation ||= entry_scope.relation
    end

    def filtered_entries
      @filtered_entries ||= filtered_entries_relation.select(:id, :lat, :lng)
    end

    def cells
      @cells ||= begin
        grouped_rows.filter_map do |row|
          cell = {
            ix: row.ix.to_i,
            iy: row.iy.to_i,
            entry_count: row.entry_count.to_i,
            with_count: row.with_count.to_i,
            sum_count: row.sum_count.to_i,
          }
          next if cell[:entry_count] < min_n

          value = metric_value(cell)
          next unless value.positive?

          cell.merge(value: value)
        end.sort_by { |cell| [cell[:iy], cell[:ix]] }
      end
    end

    def grouped_rows
      @grouped_rows ||= begin
        entry_alias = "filtered_entries"
        count_alias = "selected_counts"
        selected_bird_id = selected_bird_db_id
        ix_sql = projected_cell_sql("#{entry_alias}.lng")
        iy_sql = projected_cell_sql("#{entry_alias}.lat", latitude: true)

        Entry
          .unscoped
          .from("(#{filtered_entries.to_sql}) #{entry_alias}")
          .joins(
            "LEFT JOIN entry_bird_counts #{count_alias} " \
            "ON #{count_alias}.entry_id = #{entry_alias}.id " \
            "AND #{count_alias}.bird_id = #{selected_bird_id}",
          )
          .group(ix_sql, iy_sql)
          .select(
            "#{ix_sql} AS ix",
            "#{iy_sql} AS iy",
            "COUNT(*) AS entry_count",
            "SUM(CASE WHEN COALESCE(#{count_alias}.count, 0) > 0 THEN 1 ELSE 0 END) AS with_count",
            "SUM(COALESCE(#{count_alias}.count, 0)) AS sum_count",
          )
      end
    end

    def summary
      @summary ||= begin
        entry_count = filtered_entries_relation.count
        with_count = grouped_rows.sum { |row| row.with_count.to_i }
        sum_count = grouped_rows.sum { |row| row.sum_count.to_i }
        {
          entry_count: entry_count,
          with_count: with_count,
          sum_count: sum_count,
          avg_count: entry_count.positive? ? (sum_count.to_f / entry_count) : 0.0,
        }
      end
    end

    def selected_bird_db_id
      @selected_bird_db_id ||= Bird.where(external_id: bird_id).pick(:id).to_i
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

    def projected_cell_sql(column_sql, latitude: false)
      if latitude
        mercator_sql =
          "#{EARTH_RADIUS_M} * LN(TAN(PI()/4.0 + " \
          "RADIANS(LEAST(GREATEST(#{column_sql}, -#{MAX_LATITUDE}), #{MAX_LATITUDE})) / 2.0))"
      else
        mercator_sql = "#{EARTH_RADIUS_M} * RADIANS(#{column_sql})"
      end

      "FLOOR((#{mercator_sql}) / #{cell_size_m.to_f})"
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
