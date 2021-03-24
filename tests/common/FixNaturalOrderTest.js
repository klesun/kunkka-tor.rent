import FixNaturalOrder, {splitTillFirstNumber} from "../../src/common/FixNaturalOrder.js";

const provide_splitTillFirstNumber = () => {
    const testCases = [];

    testCases.push({
        title: 'example #1.1',
        input: "Avatar - The Last Airbender (2005 - 2008) [1080p]/Book Two - Earth/Avatar - The Last Airbender - S02E01 - The Avatar State.mkv",
        output: {
            prefix: 'Avatar - The Last Airbender (',
            digit: '2005',
            postfix: ' - 2008) [1080p]/Book Two - Earth/Avatar - The Last Airbender - S02E01 - The Avatar State.mkv',
        },
    });

    testCases.push({
        title: 'example #1.2',
        input: " - 2008) [1080p]/Book Two - Earth/Avatar - The Last Airbender - S02E01 - The Avatar State.mkv",
        output: {
            prefix: ' - ',
            digit: '2008',
            postfix: ') [1080p]/Book Two - Earth/Avatar - The Last Airbender - S02E01 - The Avatar State.mkv',
        },
    });

    testCases.push({
        title: 'example #1.3',
        input: ") [1080p]/Book Two - Earth/Avatar - The Last Airbender - S02E01 - The Avatar State.mkv",
        output: {
            prefix: ') [',
            digit: '1080',
            postfix: 'p]/Book Two - Earth/Avatar - The Last Airbender - S02E01 - The Avatar State.mkv',
        },
    });

    testCases.push({
        title: 'example #1.4 FINAL',
        input: "p]/Book Two - Earth/Avatar - The Last Airbender - S02E01 - The Avatar State.mkv",
        output: {
            prefix: 'p]/Book ',
            digit: '2',
            postfix: ' - Earth/Avatar - The Last Airbender - S02E01 - The Avatar State.mkv',
        },
    });

    return testCases.map(c => [c]);
};

const provide_call = () => {
    const testCases = [];

    testCases.push({
        title: 'Example of torrent contents listing with inconsistent ordering',
        input: {
            items: [
                'Avatar - The Last Airbender - Imbalance (2018-2019)/Avatar - The Last Airbender - Imbalance Part 03 (2019) (digital) (Son of Ultron-Empire).cbr',
                'Avatar - The Last Airbender - Imbalance (2018-2019)/Avatar - The Last Airbender - Imbalance Part 01 (2018) (digital) (Son of Ultron-Empire).cbr',
                'Avatar - The Last Airbender - Imbalance (2018-2019)/Avatar - The Last Airbender - Imbalance Part 02 (2019) (digital) (Son of Ultron-Empire).cbr',
            ],
            getName: a => a,
        },
        output: {
            sortedItems: [
                'Avatar - The Last Airbender - Imbalance (2018-2019)/Avatar - The Last Airbender - Imbalance Part 01 (2018) (digital) (Son of Ultron-Empire).cbr',
                'Avatar - The Last Airbender - Imbalance (2018-2019)/Avatar - The Last Airbender - Imbalance Part 02 (2019) (digital) (Son of Ultron-Empire).cbr',
                'Avatar - The Last Airbender - Imbalance (2018-2019)/Avatar - The Last Airbender - Imbalance Part 03 (2019) (digital) (Son of Ultron-Empire).cbr',
            ],
        },
    });

    testCases.push({
        title: 'Example from streamed zip archive',
        input: {
            items: [
                'Avatar- The Last Airbender -North and South - Part 2 (Digital) (Raven)/Avatar- The Last Airbender -North and South - Part 2-059.jpg',
                'Avatar- The Last Airbender -North and South - Part 2 (Digital) (Raven)/Avatar- The Last Airbender -North and South - Part 2-026.jpg',
                'Avatar- The Last Airbender -North and South - Part 2 (Digital) (Raven)/Avatar- The Last Airbender -North and South - Part 2-000.jpg',
                'Avatar- The Last Airbender -North and South - Part 2 (Digital) (Raven)/Avatar- The Last Airbender -North and South - Part 2-037.jpg',
                'Avatar- The Last Airbender -North and South - Part 2 (Digital) (Raven)/Avatar- The Last Airbender -North and South - Part 2-007.jpg',
                'Avatar- The Last Airbender -North and South - Part 2 (Digital) (Raven)/Avatar- The Last Airbender -North and South - Part 2-016.jpg',
                'Avatar- The Last Airbender -North and South - Part 2 (Digital) (Raven)/Avatar- The Last Airbender -North and South - Part 2-066.jpg',
            ],
            getName: a => a,
        },
        output: {
            sortedItems: [
                'Avatar- The Last Airbender -North and South - Part 2 (Digital) (Raven)/Avatar- The Last Airbender -North and South - Part 2-000.jpg',
                'Avatar- The Last Airbender -North and South - Part 2 (Digital) (Raven)/Avatar- The Last Airbender -North and South - Part 2-007.jpg',
                'Avatar- The Last Airbender -North and South - Part 2 (Digital) (Raven)/Avatar- The Last Airbender -North and South - Part 2-016.jpg',
                'Avatar- The Last Airbender -North and South - Part 2 (Digital) (Raven)/Avatar- The Last Airbender -North and South - Part 2-026.jpg',
                'Avatar- The Last Airbender -North and South - Part 2 (Digital) (Raven)/Avatar- The Last Airbender -North and South - Part 2-037.jpg',
                'Avatar- The Last Airbender -North and South - Part 2 (Digital) (Raven)/Avatar- The Last Airbender -North and South - Part 2-059.jpg',
                'Avatar- The Last Airbender -North and South - Part 2 (Digital) (Raven)/Avatar- The Last Airbender -North and South - Part 2-066.jpg',
            ],
        },
    });

    testCases.push({
        title: 'Example with seasons, also weird episode notation through dot and inconsistent between seasons, also no zero padding on some episode numbers',
        input: {
            items: [
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.11 - Party Pooped (TV).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.16 - Made in Manehattan (TV).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.09 - Slice of Life [Episode 100] (TV).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.18 - Crusaders of the Lost Mark (TV).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.17 - Brotherhooves Social (TV).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.19 - The One Where Pinkie Pie Knows (TV).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.08 - The Lost Treasure of Griffonstone (TV).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.26 - Cutie Re-Mark - Part 2 (TV).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.20 - Hearthbreakers (TV).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.22 - What About Discord (TV).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.13 - Do Princesses Dream of Magic Sheep.mkv',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.25 - Cutie Re-Mark - Part 1 (TV).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.01 - The Cutie Map - Part 1.mkv',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.21 - Scare-Master.mkv',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.05 - Tanks for the Memories.mkv',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.03 - Castle Sweet Castle.mkv',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.14 - Canterlot Boutique.mkv',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.15 - Rarity Investigates!.mkv',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.06 - Appleoosa’s Most Wanted.mkv',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.07 - Make New Friends But Keep Discord.mkv',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.04 - Bloom and Gloom.mkv',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x20 Leap of Faith (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x04 Daring Don\'t (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x01 Princess Twilight, Pt. 1 (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.02 - The Cutie Map - Part 2.mkv',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x07 Bats! (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.23 - The Hooffields and McColts.mkv',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x02 Princess Twilight, Pt. 2 (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x21 Testing, Testing, 1, 2, 3 (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x26 Twilight\'s Kingdom, Pt. 2 (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x09 Pinkie Apple Pie (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x24 Equestria Games (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x25 Twilight\'s Kingdom, Pt. 1 (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x14 Filli Vanilli (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x12 Pinkie Pride (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.12 - Amending Fences.mkv',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x22 Trade Ya (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x19 For Whom the Sweetie Bell Toils (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x08 Rarity Takes Manehattan (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x17 Somepony to Watch Over Me (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x16 It Ain\'t Easy Being Breezies (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x11 Three\'s a Crowd (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x18 Maud Pie (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x05 Flight to the Finish (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x15 Twilight Time (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x06 Power Ponies (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x10 Rainbow Falls (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x13 Simple Ways (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x23 Inspiration Manifestation (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x03 Castle-Mania (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.10 - Princess Spike (TV).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.24 - The Mane Attraction (FIV1).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S3/MLP_FiM S3 E13 - Magical Mystery Cure.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E26 - A Canterlot Wedding [part 2].mp4',
                'My Little Pony Friendship is Magic Season 1-5/S3/MLP_FiM S3 E1 - The Crystal Empire [part 1].mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E11 - Hearth\'s Warming Eve.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E15 - The Super Speedy Cider Squeezy 6000.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S3/MLP_FiM S3 E5 - Wonderbolt Academy.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S3/MLP_FiM S3 E10 - Keep Calm and Flutter On.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E18 - A Friend in Deed.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S3/MLP_FiM S3 E7 - Magic Duel.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S3/MLP_FiM S3 E3 - Apple Family Reunion.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E9 - Sweet and Elite.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S3/MLP_FiM S3 E2 - The Crystal Empire [part 2].mp4.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E23 - Cutie Mark Chronicles.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E26 - Best Night Ever.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S3/MLP_FiM S3 E11 - Just for Sidekicks.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E14 - The Last Roundup.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S3/MLP_FiM S3 E4 - One Bad Apple .mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E13 - Fall Weather Friends.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E22 - Hurricane Fluttershy.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E12 - Family Appreciation Day .mp4',
                'My Little Pony Friendship is Magic Season 1-5/S3/MLP_FiM S3 E12 - Games Ponies Play.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E21 - Over a Barrel.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E4 - Luna Eclipsed.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E10 - Swarm of the Century.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E8 - The Mysterious Mare Do Well.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E8 - Look Before You Sleep.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S3/MLP_FiM S3 E6 - Too Many Pinkie.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E25 - A Canterlot Wedding [part 1].mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E16 - Sonic Rainboom.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E6 - The Cutie Pox.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E24 - MMMystery on the Friendship Express.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E3 - Lesson Zero.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E21 - Dragon Quest.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E17 - Hearts and Hooves Day.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S3/MLP_FiM S3 E8 - Sleepless in Ponyville).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E1 - Return of Harmony [part 1].mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E2 - Return of Harmony [part 2].mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E7 - May the Best Pet Win!.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S3/MLP_FiM S3 E9 - Spike at Your Service.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E18 - The Show Stoppers.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E10 - Secret of My Excess .mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E1 - Friendship is Magic [part 1].mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E3 - The Ticket Master.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E19 - Putting Your Hoof Down.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E19 - A Dog and Pony Show.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E20 - Green Isnt Your Color.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E24 - Owl\'s Well That Ends Well.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E11 - Winter Wrap Up.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E5 - Sisterhooves Social.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E23 - Ponyville Confidential.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E20 - It\'s About Time.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E2 - Friendship is Magic [part 2].mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E15 - Feeling Pinkie Keen.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E25 - Party of One.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E17 - Stare Master.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E4 - Applebuck Season.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E13 - Baby Cakes.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E16 - Read It and Weep.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E14 - Suited for Success.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E12 - Call of the Cutie.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E6 - Boast Busters.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E22 - A Bird in the Hoof.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E9 - Bridle Gossip.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E7 - Dragonshy.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E5 - Griffon the Brush Off.mp4',
            ],
            getName: a => a,
        },
        output: {
            sortedItems: [
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E1 - Friendship is Magic [part 1].mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E2 - Friendship is Magic [part 2].mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E3 - The Ticket Master.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E4 - Applebuck Season.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E5 - Griffon the Brush Off.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E6 - Boast Busters.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E7 - Dragonshy.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E8 - Look Before You Sleep.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E9 - Bridle Gossip.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E10 - Swarm of the Century.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E11 - Winter Wrap Up.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E12 - Call of the Cutie.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E13 - Fall Weather Friends.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E14 - Suited for Success.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E15 - Feeling Pinkie Keen.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E16 - Sonic Rainboom.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E17 - Stare Master.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E18 - The Show Stoppers.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E19 - A Dog and Pony Show.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E20 - Green Isnt Your Color.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E21 - Over a Barrel.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E22 - A Bird in the Hoof.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E23 - Cutie Mark Chronicles.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E24 - Owl\'s Well That Ends Well.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E25 - Party of One.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S1/MLP_FiM S1 E26 - Best Night Ever.mp4',

                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E1 - Return of Harmony [part 1].mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E2 - Return of Harmony [part 2].mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E3 - Lesson Zero.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E4 - Luna Eclipsed.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E5 - Sisterhooves Social.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E6 - The Cutie Pox.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E7 - May the Best Pet Win!.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E8 - The Mysterious Mare Do Well.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E9 - Sweet and Elite.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E10 - Secret of My Excess .mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E11 - Hearth\'s Warming Eve.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E12 - Family Appreciation Day .mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E13 - Baby Cakes.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E14 - The Last Roundup.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E15 - The Super Speedy Cider Squeezy 6000.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E16 - Read It and Weep.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E17 - Hearts and Hooves Day.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E18 - A Friend in Deed.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E19 - Putting Your Hoof Down.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E20 - It\'s About Time.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E21 - Dragon Quest.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E22 - Hurricane Fluttershy.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E23 - Ponyville Confidential.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E24 - MMMystery on the Friendship Express.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E25 - A Canterlot Wedding [part 1].mp4',
                'My Little Pony Friendship is Magic Season 1-5/S2/MLP_FiM S2 E26 - A Canterlot Wedding [part 2].mp4',

                'My Little Pony Friendship is Magic Season 1-5/S3/MLP_FiM S3 E1 - The Crystal Empire [part 1].mp4',
                'My Little Pony Friendship is Magic Season 1-5/S3/MLP_FiM S3 E2 - The Crystal Empire [part 2].mp4.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S3/MLP_FiM S3 E3 - Apple Family Reunion.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S3/MLP_FiM S3 E4 - One Bad Apple .mp4',
                'My Little Pony Friendship is Magic Season 1-5/S3/MLP_FiM S3 E5 - Wonderbolt Academy.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S3/MLP_FiM S3 E6 - Too Many Pinkie.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S3/MLP_FiM S3 E7 - Magic Duel.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S3/MLP_FiM S3 E8 - Sleepless in Ponyville).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S3/MLP_FiM S3 E9 - Spike at Your Service.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S3/MLP_FiM S3 E10 - Keep Calm and Flutter On.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S3/MLP_FiM S3 E11 - Just for Sidekicks.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S3/MLP_FiM S3 E12 - Games Ponies Play.mp4',
                'My Little Pony Friendship is Magic Season 1-5/S3/MLP_FiM S3 E13 - Magical Mystery Cure.mp4',

                'My Little Pony Friendship is Magic Season 1-5/S4/4x01 Princess Twilight, Pt. 1 (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x02 Princess Twilight, Pt. 2 (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x03 Castle-Mania (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x04 Daring Don\'t (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x05 Flight to the Finish (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x06 Power Ponies (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x07 Bats! (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x08 Rarity Takes Manehattan (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x09 Pinkie Apple Pie (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x10 Rainbow Falls (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x11 Three\'s a Crowd (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x12 Pinkie Pride (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x13 Simple Ways (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x14 Filli Vanilli (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x15 Twilight Time (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x16 It Ain\'t Easy Being Breezies (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x17 Somepony to Watch Over Me (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x18 Maud Pie (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x19 For Whom the Sweetie Bell Toils (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x20 Leap of Faith (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x21 Testing, Testing, 1, 2, 3 (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x22 Trade Ya (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x23 Inspiration Manifestation (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x24 Equestria Games (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x25 Twilight\'s Kingdom, Pt. 1 (720p).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S4/4x26 Twilight\'s Kingdom, Pt. 2 (720p).mp4',

                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.01 - The Cutie Map - Part 1.mkv',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.02 - The Cutie Map - Part 2.mkv',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.03 - Castle Sweet Castle.mkv',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.04 - Bloom and Gloom.mkv',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.05 - Tanks for the Memories.mkv',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.06 - Appleoosa’s Most Wanted.mkv',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.07 - Make New Friends But Keep Discord.mkv',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.08 - The Lost Treasure of Griffonstone (TV).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.09 - Slice of Life [Episode 100] (TV).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.10 - Princess Spike (TV).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.11 - Party Pooped (TV).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.12 - Amending Fences.mkv',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.13 - Do Princesses Dream of Magic Sheep.mkv',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.14 - Canterlot Boutique.mkv',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.15 - Rarity Investigates!.mkv',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.16 - Made in Manehattan (TV).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.17 - Brotherhooves Social (TV).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.18 - Crusaders of the Lost Mark (TV).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.19 - The One Where Pinkie Pie Knows (TV).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.20 - Hearthbreakers (TV).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.21 - Scare-Master.mkv',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.22 - What About Discord (TV).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.23 - The Hooffields and McColts.mkv',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.24 - The Mane Attraction (FIV1).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.25 - Cutie Re-Mark - Part 1 (TV).mp4',
                'My Little Pony Friendship is Magic Season 1-5/S5/My Little Pony FiM - 5.26 - Cutie Re-Mark - Part 2 (TV).mp4',
            ],
        },
    });

    testCases.push({
        title: 'Word numbers should be considered as well',
        input: {
            items: [
                "Avatar - The Last Airbender (2005 - 2008) [1080p]/Book One - Water/Avatar - The Last Airbender - S01E01 - The Boy in the Iceberg.mkv",
                "Avatar - The Last Airbender (2005 - 2008) [1080p]/Book One - Water/Avatar - The Last Airbender - S01E02 - The Avatar Returns.mkv",
                "Avatar - The Last Airbender (2005 - 2008) [1080p]/Book One - Water/Avatar - The Last Airbender - S01E03 - The Southern Air Temple.mkv",
                "Avatar - The Last Airbender (2005 - 2008) [1080p]/Book Three - Fire/Avatar - The Last Airbender - S03E01 - The Awakening.mkv",
                "Avatar - The Last Airbender (2005 - 2008) [1080p]/Book Three - Fire/Avatar - The Last Airbender - S03E02 - The Headband.mkv",
                "Avatar - The Last Airbender (2005 - 2008) [1080p]/Book Three - Fire/Avatar - The Last Airbender - S03E03 - The Painted Lady.mkv",
                "Avatar - The Last Airbender (2005 - 2008) [1080p]/Book Two - Earth/Avatar - The Last Airbender - S02E01 - The Avatar State.mkv",
                "Avatar - The Last Airbender (2005 - 2008) [1080p]/Book Two - Earth/Avatar - The Last Airbender - S02E02 - The Cave of Two Lovers.mkv",
                "Avatar - The Last Airbender (2005 - 2008) [1080p]/Book Two - Earth/Avatar - The Last Airbender - S02E03 - Return to Omashu.mkv",
            ],
            getName: a => a,
        },
        output: {
            sortedItems: [
                "Avatar - The Last Airbender (2005 - 2008) [1080p]/Book One - Water/Avatar - The Last Airbender - S01E01 - The Boy in the Iceberg.mkv",
                "Avatar - The Last Airbender (2005 - 2008) [1080p]/Book One - Water/Avatar - The Last Airbender - S01E02 - The Avatar Returns.mkv",
                "Avatar - The Last Airbender (2005 - 2008) [1080p]/Book One - Water/Avatar - The Last Airbender - S01E03 - The Southern Air Temple.mkv",
                "Avatar - The Last Airbender (2005 - 2008) [1080p]/Book Two - Earth/Avatar - The Last Airbender - S02E01 - The Avatar State.mkv",
                "Avatar - The Last Airbender (2005 - 2008) [1080p]/Book Two - Earth/Avatar - The Last Airbender - S02E02 - The Cave of Two Lovers.mkv",
                "Avatar - The Last Airbender (2005 - 2008) [1080p]/Book Two - Earth/Avatar - The Last Airbender - S02E03 - Return to Omashu.mkv",
                "Avatar - The Last Airbender (2005 - 2008) [1080p]/Book Three - Fire/Avatar - The Last Airbender - S03E01 - The Awakening.mkv",
                "Avatar - The Last Airbender (2005 - 2008) [1080p]/Book Three - Fire/Avatar - The Last Airbender - S03E02 - The Headband.mkv",
                "Avatar - The Last Airbender (2005 - 2008) [1080p]/Book Three - Fire/Avatar - The Last Airbender - S03E03 - The Painted Lady.mkv",
            ],
        },
    });

    return testCases.map(c => [c]);
};

class ExternalTrackMatcherTest extends require('klesun-node-tools/src/Transpiled/Lib/TestCase.js') {
    test_call({input, output}) {
        const actual = FixNaturalOrder(input);
        this.assertSubTree(output, actual);
    }

    test_splitTillFirstNumber({input, output}) {
        const actual = splitTillFirstNumber(input);
        this.assertSubTree(output, actual);
    }

    getTestMapping() {
        return [
            [provide_splitTillFirstNumber, this.test_splitTillFirstNumber],
            [provide_call, this.test_call],
        ];
    }
}

module.exports = ExternalTrackMatcherTest;