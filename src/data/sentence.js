export const paragraphs = [
    // "A plant is one of the most important living things that develop on the earth and is made up of stems, leaves, roots, and so on. Parts of Plants: The part of the plant that developed beneath the soil is referred to as root and the part that grows outside of the soil is known as shoot. The shoot consists of stems, branches, leaves, fruits, and flowers. Plants are made up of six main parts: roots, stems, leaves, flowers, fruits, and seeds.",
    
    // "The root is the part of the plant that grows in the soil. The primary root emerges from the embryo. Its primary function is to provide the plant stability in the earth and make other mineral salts from the earth available to the plant for various metabolic processes. There are three types of roots i.e. Tap Root, Adventitious Roots, and Lateral Root. The roots arise from the parts of the plant and not from the rhizomes roots.",
    
    // "Stem is the posterior part that remains above the ground and grows negatively geotropic. Internodes and nodes are found on the stem. Branch, bud, leaf, petiole, flower, and inflorescence on a node are all those parts of the plant that remain above the ground and undergo negative subsoil development. The trees have brown bark and the young and newly developed stems are green. The roots arise from the parts of plant and not from the rhizomes roots.",
    
    // "It is the blossom of a plant. A flower is the part of a plant that produces seeds, which eventually become other flowers. They are the reproductive system of a plant. Most flowers consist of 04 main parts that are sepals, petals, stamens, and carpels. The female portion of the flower is the carpels. The majority of flowers are hermaphrodites, meaning they have both male and female components. Others may consist of one of two parts and may be male or female.",
    
    // "An aunt is a bassoon from the right perspective. As far as we can estimate, some posit the melic myanmar to be less than kutcha. One cannot separate foods from blowzy bows. The scampish closet reveals itself as a sclerous llama to those who look. A hip is the skirt of a peak. Some hempy laundries are thought of simply as orchids. A gum is a trumpet from the right perspective. A freebie flight is a wrench of the mind. Some posit the croupy.",

    // "some posit the melic myanmar to be less than kutcha. One cannot separate foods from blowzy bows. The scampish closet reveals"
    "A plant is one of the most important living things that develop on the earth and is made up of stems, leaves, roots, and so on. Parts of Plants: The part of the plant that developed beneath the soil is referred to as root and the part that grows outside of the soil is known as shoot.",
    
    "The root is the part of the plant that grows in the soil. The primary root emerges from the embryo. Its primary function is to provide the plant stability in the earth and make other mineral salts from the earth available to the plant for various metabolic processes.",
    
    "Stem is the posterior part that remains above the ground and grows negatively geotropic. Internodes and nodes are found on the stem. Branch, bud, leaf, petiole, flower, and inflorescence on a node are all those parts of the plant that remain above the ground and undergo negative subsoil development.",
    
    "It is the blossom of a plant. A flower is the part of a plant that produces seeds, which eventually become other flowers. The majority of flowers are hermaphrodites, meaning they have both male and female components. ",
    
    "An aunt is a bassoon from the right perspective. As far as we can estimate, some posit the melic myanmar to be less than kutcha. One cannot separate foods from blowzy bows. The scampish closet reveals itself as a sclerous llama to those who look. ",

    "Some posit the melic myanmar to be less than kutcha. One cannot separate foods from blowzy bows. The scampish closet reveals",

    "There was some point as he grew up that he played with each of his friends for the very last time, and he had no idea that it would be the last.",

    "She counted. One. She could hear the steps coming closer. Two. Puffs of breath could be seen coming from his mouth. Three. He stopped beside her. Four. She pulled the trigger of the gun.",

    "It was his baby and he spent hours caring for it, pampering it, and fondling over it. She knew this all too well, and that's exactly why she had taken a sludge hammer to it.",
    
    "The red glint of paint sparkled under the sun. He had dreamed of owning this car since he was ten, and that dream had become a reality less than a year ago.",

    "The leather jacked showed the scars of being his favorite for years. It wore those scars with pride, feeling that they enhanced his presence rather than diminishing it.",

    "His parents continued to question him. He didn't know what to say to them since they refused to believe the truth. He explained again and again, and they dismissed his explanation as a figment of his imagination."
    
];
export const paragraphWordMeans = (paragraph) =>{
    const num = paragraph.split(' ').length+1;
    // console.log((paragraph.length-num)/num)

    
    return (paragraph.length-num)/num
}
