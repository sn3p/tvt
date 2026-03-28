require "json"

namespace :tvt do
  def print_year_summary!(year)
    summary = Ops::StatusSnapshot.new.year_summary(year)
    puts(JSON.pretty_generate(summary || { year: year, error: "year not present" }))
  end

  desc "Import one harvested TVT year into the backend database"
  task :import_year, [:year] => :environment do |_task, args|
    year = Integer(args[:year] || ENV.fetch("YEAR"))
    Imports::YearImporter.new.import_year(year)
    print_year_summary!(year)
  end

  desc "Import all harvested TVT years visible to the backend"
  task import_all: :environment do
    source = Imports::HarvestSource.new
    years = source.available_years
    raise ArgumentError, "No harvested years found under #{source.root}" if years.empty?

    importer = Imports::YearImporter.new(source:)
    years.each do |year|
      importer.import_year(year)
      print_year_summary!(year)
    end
  end

  desc "Rebuild tile memberships for one imported TVT year"
  task :rebuild_tiles, [:year] => :environment do |_task, args|
    year = Integer(args[:year] || ENV.fetch("YEAR"))
    Imports::EntryTileMembershipBuilder.new.rebuild_year(year)
    print_year_summary!(year)
  end

  desc "Print the current backend status snapshot as JSON"
  task status: :environment do
    puts(JSON.pretty_generate(Ops::StatusSnapshot.new.as_json))
  end
end
