module Species
  class CatalogSnapshot
    def initialize(area_slug:, year:, pc4: nil, include_private: nil, include_isorg: nil, scope: nil, bbox: nil)
      @area = Areas::Catalog.fetch!(area_slug)
      @entry_scope = EntryScope.new(
        area_slug: area_slug,
        year: year,
        pc4: pc4,
        include_private: include_private,
        include_isorg: include_isorg,
        scope: scope,
        bbox: bbox,
      )
      @year = Integer(year)
      @pc4 = pc4.to_s.strip.presence
      @scope = entry_scope.send(:scope)
    end

    def as_json(*)
      {
        area: {
          slug: area.slug,
          name: area.name,
          type: area.type,
          code: area.code,
        },
        year: year,
        scope: scope,
        filters: {
          pc4: pc4,
          include_private: include_private?,
          include_isorg: include_isorg?,
          bbox: entry_scope_bbox,
        },
        species: species_rows,
      }
    end

    private

    attr_reader :area, :entry_scope, :year, :pc4, :scope

    def base_relation
      @base_relation ||= EntryBirdCount.joins(:entry, :bird).merge(entry_scope.relation)
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

    def include_private?
      entry_scope.relation.where_values_hash.fetch("is_org", nil) != true
    end

    def include_isorg?
      entry_scope.relation.where_values_hash.fetch("is_org", nil) != false
    end

    def entry_scope_bbox
      return nil unless scope == "viewport"

      bbox = entry_scope.send(:bbox)
      [bbox[:west], bbox[:south], bbox[:east], bbox[:north]]
    end
  end
end
