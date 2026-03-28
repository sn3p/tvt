module Imports
  class YearImporter
    def initialize(source: HarvestSource.new, logger: Rails.logger)
      @entry_importer = EntryImporter.new(source:, logger:)
      @entry_bird_count_importer = EntryBirdCountImporter.new(source:, logger:)
      @entry_tile_membership_builder = EntryTileMembershipBuilder.new(logger:)
    end

    def import_year(year)
      entry_importer.import_year(year)
      entry_bird_count_importer.import_year(year)
      entry_tile_membership_builder.rebuild_year(year)
    end

    private

    attr_reader :entry_importer, :entry_bird_count_importer, :entry_tile_membership_builder
  end
end
