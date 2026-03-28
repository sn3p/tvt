module Species
  class ManifestSnapshot
    def initialize(area_slug:, year:)
      @area = Areas::Catalog.fetch!(area_slug)
      @year = Integer(year)
    end

    def as_json(*)
      {
        area: {
          slug: area.slug,
          name: area.name,
          type: area.type,
          code: area.code,
          generated_at_utc: area.generated_at_utc,
        },
        year: year,
        pc4_count: area.pc4_codes.length,
        entry_count: entries.count,
        private_entries_count: entries.where(is_org: false).count,
        isorg_entries_count: entries.where(is_org: true).count,
        species_count: species_count,
        latest_update_utc: latest_update&.utc&.iso8601,
      }
    end

    private

    attr_reader :area, :year

    def entries
      @entries ||= Entry.for_year(year).where(pc4: area.pc4_codes)
    end

    def species_count
      EntryBirdCount.joins(:entry).merge(entries).distinct.count(:bird_id)
    end

    def latest_update
      [entries.maximum(:updated_at), latest_bird_update].compact.max
    end

    def latest_bird_update
      EntryBirdCount.joins(:entry).merge(entries).maximum(:updated_at)
    end
  end
end
