module Species
  class CatalogSnapshot
    def initialize(area_slug:, year:, pc4: nil, include_private: nil, include_isorg: nil, scope: nil, bbox: nil)
      @entry_scope = EntryScope.new(
        area_slug: area_slug,
        year: year,
        pc4: pc4,
        include_private: include_private,
        include_isorg: include_isorg,
        scope: scope,
        bbox: bbox,
      )
      @area = entry_scope.area
      @year = Integer(year)
    end

    def as_json(*)
      {
        area: serialized_area,
        year: year,
        scope: entry_scope.scope,
        filters: {
          pc4: entry_scope.pc4,
          include_private: entry_scope.include_private,
          include_isorg: entry_scope.include_isorg,
          bbox: serialized_bbox,
        },
        entry_count: entries.count,
        private_entries_count: entries.where(is_org: false).count,
        isorg_entries_count: entries.where(is_org: true).count,
        species: species_rows,
      }
    end

    private

    attr_reader :area, :entry_scope, :year

    def entries
      @entries ||= entry_scope.relation
    end

    def base_relation
      @base_relation ||= EntryBirdCount.joins(:entry, :bird).merge(entries)
    end

    def species_rows
      @species_rows ||= begin
        rows = base_relation
          .group("birds.external_id", "birds.name")
          .select(
            "birds.external_id AS bird_external_id",
            "birds.name AS bird_name",
            "SUM(CASE WHEN entry_bird_counts.count > 0 THEN 1 ELSE 0 END) AS with_count",
            "SUM(entry_bird_counts.count) AS sum_count"
          )
          .having("SUM(entry_bird_counts.count) > 0")
          .order(Arel.sql("SUM(CASE WHEN entry_bird_counts.count > 0 THEN 1 ELSE 0 END) DESC, SUM(entry_bird_counts.count) DESC, birds.name ASC"))

        rows.map do |row|
          {
            bird_id: row.bird_external_id,
            name: row.bird_name,
            with_count: row.with_count.to_i,
            sum_count: row.sum_count.to_i,
          }
        end
      end
    end

    def serialized_bbox
      return nil unless entry_scope.scope == "viewport"

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
